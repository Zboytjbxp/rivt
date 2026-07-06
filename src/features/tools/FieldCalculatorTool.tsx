import { ArrowLeft, Clipboard, Copy, RotateCcw, Ruler } from "lucide-react";
import { useState } from "react";

type ActiveUnit = "feet" | "inches";
type InputMode = "imperial" | "metric";
type Operator = "+" | "-" | "x" | "/";

const UNITS_PER_MM = 160;
const UNITS_PER_INCH = 4064;
const UNITS_PER_FOOT = UNITS_PER_INCH * 12;
const UNITS_PER_THIRTY_SECOND = 127;
const IMPERIAL_TRIM_UNITS = UNITS_PER_THIRTY_SECOND;
const METRIC_TRIM_UNITS = UNITS_PER_MM / 2;
const FRACTION_BUTTONS = Array.from({ length: 15 }, (_, index) => index + 1);
const METRIC_TENTH_BUTTONS = Array.from({ length: 9 }, (_, index) => index + 1);
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
  if (Number.isInteger(value)) return new Intl.NumberFormat().format(value);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function getDecimalSeparator() {
  return new Intl.NumberFormat().formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function reduceFraction(thirtySeconds: number) {
  if (!thirtySeconds) return "";
  const divisor = gcd(thirtySeconds, 32);
  return `${thirtySeconds / divisor}/${32 / divisor}`;
}

function fractionLabelFromSixteenth(value: number) {
  return reduceFraction(value * 2);
}

function formatMillimeters(units: number) {
  const millimeters = units / UNITS_PER_MM;
  return `${formatNumber(millimeters, 1)} mm`;
}

function formatCentimeters(units: number) {
  return `${formatNumber(units / (UNITS_PER_MM * 10), 2)} cm`;
}

function formatMeters(units: number) {
  return `${formatNumber(units / (UNITS_PER_MM * 1000), 3)} m`;
}

function formatMeasurement(units: number) {
  const sign = units < 0 ? "-" : "";
  const safeValue = Math.abs(Math.round(units));
  const totalThirtySeconds = Math.round(safeValue / UNITS_PER_THIRTY_SECOND);
  const totalInches = Math.floor(totalThirtySeconds / 32);
  const fraction32 = totalThirtySeconds % 32;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const fraction = reduceFraction(fraction32);

  if (feet > 0) {
    return `${sign}${feet}' ${inches}${fraction ? ` ${fraction}` : ""}"`;
  }

  return `${sign}${inches}${fraction ? ` ${fraction}` : ""}"`;
}

function formatMeasurementLong(units: number) {
  return `${formatMeasurement(units)} / ${formatNumber(units / UNITS_PER_INCH, 3)} in`;
}

function valueFromImperialEntry(feetText: string, inchesText: string, fraction32: number) {
  const feet = Math.max(0, Number(feetText) || 0);
  const inches = Math.max(0, Number(inchesText) || 0);
  return feet * UNITS_PER_FOOT + inches * UNITS_PER_INCH + fraction32 * UNITS_PER_THIRTY_SECOND;
}

function fieldsFromImperialValue(units: number) {
  const safeValue = Math.max(0, Math.round(units));
  const totalThirtySeconds = Math.round(safeValue / UNITS_PER_THIRTY_SECOND);
  const totalInches = Math.floor(totalThirtySeconds / 32);
  return {
    feet: String(Math.floor(totalInches / 12)),
    inches: String(totalInches % 12),
    fraction32: totalThirtySeconds % 32,
  };
}

function valueFromMetricEntry(metricText: string, metricTenths: number) {
  const millimeters = Math.max(0, Number(metricText) || 0) + metricTenths / 10;
  return Math.round(millimeters * UNITS_PER_MM);
}

function fieldsFromMetricValue(units: number) {
  const totalTenths = Math.max(0, Math.round((units / UNITS_PER_MM) * 10));
  return {
    metricText: String(Math.floor(totalTenths / 10)),
    metricTenths: totalTenths % 10,
  };
}

function formatMetricEntry(metricText: string, metricTenths: number) {
  const decimalSeparator = getDecimalSeparator();
  return `${new Intl.NumberFormat().format(Number(metricText) || 0)}${metricTenths ? `${decimalSeparator}${metricTenths}` : ""} mm`;
}

function computeOperation(leftUnits: number, operator: Operator, rightUnits: number, inputMode: InputMode) {
  if (operator === "+") return leftUnits + rightUnits;
  if (operator === "-") return leftUnits - rightUnits;

  const scalar = inputMode === "metric"
    ? rightUnits / UNITS_PER_MM
    : rightUnits / UNITS_PER_INCH;

  if (operator === "x") return Math.round(leftUnits * scalar);
  if (!scalar) return leftUnits;
  return Math.round(leftUnits / scalar);
}

export function FieldCalculatorTool({ onBack }: { onBack?: () => void }) {
  const [inputMode, setInputMode] = useState<InputMode>("imperial");
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>("inches");
  const [feetText, setFeetText] = useState("0");
  const [inchesText, setInchesText] = useState("0");
  const [fraction32, setFraction32] = useState(0);
  const [metricText, setMetricText] = useState("0");
  const [metricTenths, setMetricTenths] = useState(0);
  const [accumulatorUnits, setAccumulatorUnits] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [resultUnits, setResultUnits] = useState<number | null>(null);
  const [historyLabel, setHistoryLabel] = useState("Ready");
  const [copied, setCopied] = useState(false);

  const entryValueUnits = inputMode === "metric"
    ? valueFromMetricEntry(metricText, metricTenths)
    : valueFromImperialEntry(feetText, inchesText, fraction32);
  const displayValueUnits = resultUnits ?? entryValueUnits;

  function setImperialEntryFromValue(nextUnits: number) {
    const fields = fieldsFromImperialValue(nextUnits);
    setFeetText(fields.feet);
    setInchesText(fields.inches);
    setFraction32(fields.fraction32);
  }

  function setMetricEntryFromValue(nextUnits: number) {
    const fields = fieldsFromMetricValue(nextUnits);
    setMetricText(fields.metricText);
    setMetricTenths(fields.metricTenths);
  }

  function setEntryFromValue(nextUnits: number, mode = inputMode) {
    if (mode === "metric") {
      setMetricEntryFromValue(nextUnits);
    } else {
      setImperialEntryFromValue(nextUnits);
    }
    setResultUnits(null);
  }

  function switchMode(nextMode: InputMode) {
    if (nextMode === inputMode) return;
    const base = displayValueUnits;
    setInputMode(nextMode);
    if (nextMode === "metric") {
      setMetricEntryFromValue(base);
    } else {
      setImperialEntryFromValue(base);
      setActiveUnit("inches");
    }
    setCopied(false);
  }

  function handleDigit(digit: string) {
    if (resultUnits !== null && pendingOperator === null) {
      setEntryFromValue(0);
    }

    if (inputMode === "metric") {
      setMetricText((current) => {
        const clean = current === "0" ? "" : current;
        const next = `${clean}${digit}`.slice(0, 5);
        return next || "0";
      });
      setResultUnits(null);
      setCopied(false);
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => {
      const clean = current === "0" ? "" : current;
      const next = `${clean}${digit}`.slice(0, activeUnit === "feet" ? 3 : 2);
      return next || "0";
    });
    setResultUnits(null);
    setCopied(false);
  }

  function handleBackspace() {
    if (inputMode === "metric") {
      if (metricTenths) {
        setMetricTenths(0);
      } else {
        setMetricText((current) => current.length > 1 ? current.slice(0, -1) : "0");
      }
      setResultUnits(null);
      return;
    }

    if (fraction32) {
      setFraction32(0);
      setResultUnits(null);
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => current.length > 1 ? current.slice(0, -1) : "0");
    setResultUnits(null);
  }

  function clearAll() {
    setFeetText("0");
    setInchesText("0");
    setFraction32(0);
    setMetricText("0");
    setMetricTenths(0);
    setAccumulatorUnits(null);
    setPendingOperator(null);
    setResultUnits(null);
    setHistoryLabel("Ready");
    setCopied(false);
  }

  function adjustEntry(deltaUnits: number) {
    const base = resultUnits ?? entryValueUnits;
    setEntryFromValue(Math.max(0, base + deltaUnits));
    setCopied(false);
  }

  function scaleEntry(multiplier: number) {
    const base = resultUnits ?? entryValueUnits;
    const next = Math.max(0, Math.round(base * multiplier));
    setEntryFromValue(next);
    setHistoryLabel(`${inputMode === "metric" ? formatMillimeters(base) : formatMeasurement(base)} ${multiplier === 2 ? "x2" : "/2"}`);
    setAccumulatorUnits(null);
    setPendingOperator(null);
    setCopied(false);
  }

  function chooseFraction(sixteenth: number) {
    setFraction32(sixteenth * 2);
    setResultUnits(null);
    setCopied(false);
  }

  function chooseMetricTenth(tenth: number) {
    setMetricTenths(tenth);
    setResultUnits(null);
    setCopied(false);
  }

  function applyOperator(operator: Operator) {
    const current = resultUnits ?? entryValueUnits;
    const nextAccumulator = accumulatorUnits !== null && pendingOperator
      ? computeOperation(accumulatorUnits, pendingOperator, current, inputMode)
      : current;

    setAccumulatorUnits(nextAccumulator);
    setPendingOperator(operator);
    setHistoryLabel(`${inputMode === "metric" ? formatMillimeters(nextAccumulator) : formatMeasurement(nextAccumulator)} ${operator}`);
    setEntryFromValue(0);
    if (inputMode === "imperial") {
      setActiveUnit("inches");
    }
  }

  function evaluate() {
    const current = resultUnits ?? entryValueUnits;
    if (accumulatorUnits === null || !pendingOperator) {
      setResultUnits(current);
      setHistoryLabel(inputMode === "metric" ? formatMillimeters(current) : formatMeasurement(current));
      return;
    }

    const nextResult = computeOperation(accumulatorUnits, pendingOperator, current, inputMode);
    setResultUnits(nextResult);
    setHistoryLabel(
      `${inputMode === "metric" ? formatMillimeters(accumulatorUnits) : formatMeasurement(accumulatorUnits)} ${pendingOperator} ${inputMode === "metric" ? formatMillimeters(current) : formatMeasurement(current)}`,
    );
    setAccumulatorUnits(null);
    setPendingOperator(null);
    setCopied(false);
  }

  async function copyCalculatorResult() {
    const text = [
      "RIVT Heavy 16th",
      `Result: ${formatMeasurementLong(displayValueUnits)}`,
      `Metric: ${formatMillimeters(displayValueUnits)} (${formatMeters(displayValueUnits)})`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const primaryValue = inputMode === "metric" ? formatMillimeters(displayValueUnits) : formatMeasurement(displayValueUnits);
  const secondaryLabel = inputMode === "metric" ? "Metres" : "Decimal";
  const secondaryValue = inputMode === "metric"
    ? formatMeters(displayValueUnits)
    : `${formatNumber(displayValueUnits / UNITS_PER_INCH, 3)} in`;
  const metaValues = inputMode === "metric"
    ? [formatMillimeters(displayValueUnits), formatCentimeters(displayValueUnits), formatMeters(displayValueUnits), formatMeasurement(displayValueUnits)]
    : [
        `${formatNumber(displayValueUnits / UNITS_PER_INCH, 3)} in`,
        `${formatNumber(displayValueUnits / UNITS_PER_FOOT, 3)} ft`,
        formatMillimeters(displayValueUnits),
        pendingOperator ? `${pendingOperator} pending` : activeUnit === "feet" ? "Entering feet" : "Entering inches",
      ];
  const resultCardPrimary = inputMode === "metric" ? formatMillimeters(displayValueUnits) : formatMeasurement(displayValueUnits);
  const resultCardSecondaryLabel = inputMode === "metric" ? "Imperial" : "Metric";
  const resultCardSecondaryValue = inputMode === "metric"
    ? formatMeasurement(displayValueUnits)
    : formatMillimeters(displayValueUnits);

  return (
    <section className="heavy-calc-workbench fraction-calc-workbench" aria-label="Heavy 16th field calculator">
      <h1 className="sr-only">Heavy 16th field calculator</h1>
      <header className="heavy-calc-topbar">
        <button
          type="button"
          className={onBack ? "calc-menu-button calc-back-button calc-tools-button" : "calc-menu-button"}
          aria-label={onBack ? "Back to tools" : "Clear calculator"}
          onClick={onBack ?? clearAll}
        >
          {onBack ? (
            <>
              <ArrowLeft size={16} />
              <span className="calc-topbar-label">Back</span>
            </>
          ) : <RotateCcw size={18} />}
        </button>
        <div className="heavy-calc-brand">
          <div className="heavy-calc-brand-mark" aria-hidden="true">
            <Ruler size={22} />
          </div>
          <div>
            <strong>{inputMode === "metric" ? "METRIC CUT" : "HEAVY 16TH"}</strong>
          </div>
        </div>
        <div className="heavy-calc-actions">
          <button type="button" className="calc-action-button" aria-label="Clear calculator" onClick={clearAll}>
            <RotateCcw size={15} />
            <span className="calc-topbar-label">Clear</span>
          </button>
          <button type="button" className="calc-exit-button calc-action-button" aria-label={copied ? "Copied result" : "Copy result"} onClick={copyCalculatorResult}>
            <Copy size={15} />
            <span className="calc-topbar-label">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </header>

      <div className="heavy-calc-shell fraction-calc-shell fraction-only-shell">
        <main className="heavy-calc-main fraction-calc-main length-mode">
          <section className="fraction-calc-grid" aria-label="Length calculator">
            <div className="fraction-calc-left">
              <div className="calc-display-stack fraction-display">
                <span className="fraction-history">{historyLabel}</span>
                <strong className="calc-primary-value">{primaryValue}</strong>
                <div className="calc-secondary-row">
                  <span>{secondaryLabel}</span>
                  <strong>{secondaryValue}</strong>
                </div>
                <div className="fraction-display-meta">
                  {metaValues.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
                </div>
              </div>

              <div className="fraction-unit-row" aria-label={inputMode === "metric" ? "Metric input and conversions" : "Input unit"}>
                {inputMode === "metric" ? (
                  <>
                    <button type="button" className="active unit-metric" aria-pressed="true">
                      <span>MM</span>
                      <strong>{formatMetricEntry(metricText, metricTenths).replace(" mm", "")}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" tabIndex={-1}>
                      <span>CM</span>
                      <strong>{formatNumber(displayValueUnits / (UNITS_PER_MM * 10), 2)}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" tabIndex={-1}>
                      <span>M</span>
                      <strong>{formatNumber(displayValueUnits / (UNITS_PER_MM * 1000), 3)}</strong>
                    </button>
                    <button
                      type="button"
                      className="unit-metric"
                      aria-label="Switch to imperial mode"
                      onClick={() => switchMode("imperial")}
                    >
                      <span>IMP</span>
                      <strong>ON</strong>
                    </button>
                  </>
                ) : (
                  <>
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
                      className="unit-metric"
                      aria-label="Switch to metric mode"
                      onClick={() => switchMode("metric")}
                    >
                      <span>MET</span>
                      <strong>ON</strong>
                    </button>
                  </>
                )}
              </div>

              <div className="fraction-action-row" aria-label="Heavy, light, double, and half controls">
                <button
                  type="button"
                  aria-label={inputMode === "metric" ? "Light minus half millimetre" : "Light minus one thirty-second"}
                  onClick={() => adjustEntry(inputMode === "metric" ? -METRIC_TRIM_UNITS : -IMPERIAL_TRIM_UNITS)}
                >
                  <strong>L</strong>
                  <small>{inputMode === "metric" ? "-0.5 mm" : "Light"}</small>
                </button>
                <button
                  type="button"
                  aria-label={inputMode === "metric" ? "Heavy plus half millimetre" : "Heavy plus one thirty-second"}
                  onClick={() => adjustEntry(inputMode === "metric" ? METRIC_TRIM_UNITS : IMPERIAL_TRIM_UNITS)}
                >
                  <strong>H</strong>
                  <small>{inputMode === "metric" ? "+0.5 mm" : "Heavy"}</small>
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

              {inputMode === "metric" ? (
                <div className="fraction-strip metric-strip" aria-label="Metric decimal tenths">
                  {METRIC_TENTH_BUTTONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={metricTenths === value ? "active" : ""}
                      onClick={() => chooseMetricTenth(value)}
                    >
                      .{value}
                    </button>
                  ))}
                </div>
              ) : (
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
              )}

              <div className="calc-pad-grid fraction-pad" aria-label={inputMode === "metric" ? "Metric calculator keypad" : "Fraction calculator keypad"}>
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
              <strong>{resultCardPrimary}</strong>
              <small>{inputMode === "metric" ? formatCentimeters(displayValueUnits) : `${formatNumber(displayValueUnits / UNITS_PER_INCH, 3)} in`}</small>
              <div>
                <span>{resultCardSecondaryLabel}</span>
                <b>{resultCardSecondaryValue}</b>
              </div>
            </aside>
          </section>
        </main>

        <aside className="heavy-calc-ruler fraction-ruler" aria-label="Sixteenth tape reference" aria-hidden="true">
          {RULER_TICKS.map((tick) => (
            <button
              key={tick.value}
              type="button"
              tabIndex={-1}
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
