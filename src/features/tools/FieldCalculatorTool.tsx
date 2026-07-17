import { ArrowLeft, Clipboard, Clock3, Copy, RotateCcw, Ruler, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DialogBackdrop, DialogSurface } from "../../components/ui";

type ActiveUnit = "feet" | "inches";
type InputMode = "imperial" | "metric";
type Operator = "+" | "-" | "x" | "/";
type TapeQualifier = "light" | "exact" | "heavy";
type HeavyLightMode = "tape" | "thirty-seconds";
type ImperialNotation = "inches" | "feet-inches";
type FractionLayout = "tape" | "grouped";

const CALCULATOR_PREFS_KEY = "rivt.calculatorPrefs.v1";
const CALCULATOR_HISTORY_KEY = "rivt.calculatorHistory.v1";
const CALCULATOR_HISTORY_LIMIT = 8;
const UNITS_PER_MM = 160;
const UNITS_PER_INCH = 4064;
const UNITS_PER_FOOT = UNITS_PER_INCH * 12;
const UNITS_PER_THIRTY_SECOND = 127;
const UNITS_PER_SIXTEENTH = UNITS_PER_THIRTY_SECOND * 2;
const IMPERIAL_TRIM_UNITS = UNITS_PER_THIRTY_SECOND;
const METRIC_TRIM_UNITS = UNITS_PER_MM / 2;
const FRACTION_BUTTONS = Array.from({ length: 15 }, (_, index) => index + 1);
const GROUPED_FRACTION_BUTTONS = [4, 8, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];
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

type CalculationHistoryEntry = {
  id: string;
  expression: string;
  resultUnits: number;
  inputMode: InputMode;
  activeUnit?: ActiveUnit;
  qualifier?: TapeQualifier;
};

type CalculatorPreferences = {
  inputMode: InputMode;
  imperialNotation: ImperialNotation;
  fractionLayout: FractionLayout;
  heavyLightMode: HeavyLightMode;
};

const DEFAULT_CALCULATOR_PREFERENCES: CalculatorPreferences = {
  inputMode: "imperial",
  imperialNotation: "inches",
  fractionLayout: "tape",
  heavyLightMode: "tape",
};

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

function fractionFamilyFromSixteenth(value: number) {
  if (value % 4 === 0) return "quarter";
  if (value % 2 === 0) return "eighth";
  return "sixteenth";
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

function formatInchesMeasurement(units: number) {
  const sign = units < 0 ? "-" : "";
  const safeValue = Math.abs(Math.round(units));
  const totalThirtySeconds = Math.round(safeValue / UNITS_PER_THIRTY_SECOND);
  const totalInches = Math.floor(totalThirtySeconds / 32);
  const fraction = reduceFraction(totalThirtySeconds % 32);
  return `${sign}${totalInches}${fraction ? ` ${fraction}` : ""}"`;
}

function formatImperialMeasurement(units: number, activeUnit: ActiveUnit, qualifier: TapeQualifier = "exact") {
  const measurement = activeUnit === "feet" ? formatMeasurement(units) : formatInchesMeasurement(units);
  if (qualifier === "exact") return measurement;
  return `${measurement} ${qualifier === "heavy" ? "H" : "L"}`;
}

function valueFromImperialEntry(feetText: string, inchesText: string, fraction32: number) {
  const feet = Math.max(0, Number(feetText) || 0);
  const inches = Math.max(0, Number(inchesText) || 0);
  return feet * UNITS_PER_FOOT + inches * UNITS_PER_INCH + fraction32 * UNITS_PER_THIRTY_SECOND;
}

function fieldsFromImperialValue(units: number, activeUnit: ActiveUnit) {
  const safeValue = Math.max(0, Math.round(units));
  const totalThirtySeconds = Math.round(safeValue / UNITS_PER_THIRTY_SECOND);
  const totalInches = Math.floor(totalThirtySeconds / 32);
  if (activeUnit === "inches") {
    return {
      feet: "0",
      inches: String(totalInches),
      fraction32: totalThirtySeconds % 32,
    };
  }
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

function qualifierValue(qualifier: TapeQualifier) {
  if (qualifier === "heavy") return 1;
  if (qualifier === "light") return -1;
  return 0;
}

function qualifierFromValue(value: number): TapeQualifier {
  if (value > 0) return "heavy";
  if (value < 0) return "light";
  return "exact";
}

function computeImperialTapeOperation(
  leftUnits: number,
  leftQualifier: TapeQualifier,
  operator: Operator,
  rightUnits: number,
  rightQualifier: TapeQualifier,
) {
  if (operator === "x" || operator === "/") {
    return { units: computeOperation(leftUnits, operator, rightUnits, "imperial"), qualifier: "exact" as const };
  }

  const direction = operator === "+" ? 1 : -1;
  const qualifierTotal = qualifierValue(leftQualifier) + direction * qualifierValue(rightQualifier);
  const carry = qualifierTotal >= 2 ? 1 : qualifierTotal <= -2 ? -1 : 0;
  return {
    units: leftUnits + direction * rightUnits + carry * UNITS_PER_SIXTEENTH,
    qualifier: qualifierFromValue(qualifierTotal - carry * 2),
  };
}

function formatOperator(operator: Operator) {
  if (operator === "x") return "×";
  if (operator === "/") return "÷";
  return operator;
}

function formatForMode(
  units: number,
  mode: InputMode,
  activeUnit: ActiveUnit = "inches",
  qualifier: TapeQualifier = "exact",
) {
  return mode === "metric" ? formatMillimeters(units) : formatImperialMeasurement(units, activeUnit, qualifier);
}

function readCalculatorPreferences(): CalculatorPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALCULATOR_PREFS_KEY) ?? "null") as Partial<CalculatorPreferences> | null;
    return {
      inputMode: parsed?.inputMode === "metric" ? "metric" : "imperial",
      imperialNotation: parsed?.imperialNotation === "feet-inches" ? "feet-inches" : "inches",
      fractionLayout: parsed?.fractionLayout === "grouped" ? "grouped" : "tape",
      heavyLightMode: parsed?.heavyLightMode === "thirty-seconds" ? "thirty-seconds" : "tape",
    };
  } catch {
    return DEFAULT_CALCULATOR_PREFERENCES;
  }
}

function readCalculatorHistory(): CalculationHistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALCULATOR_HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is CalculationHistoryEntry => {
        if (!entry || typeof entry !== "object") return false;
        const candidate = entry as Partial<CalculationHistoryEntry>;
        return typeof candidate.id === "string"
          && typeof candidate.expression === "string"
          && typeof candidate.resultUnits === "number"
          && Number.isFinite(candidate.resultUnits)
          && (candidate.inputMode === "imperial" || candidate.inputMode === "metric");
      })
      .slice(0, CALCULATOR_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function FieldCalculatorTool({ onBack }: { onBack?: () => void }) {
  const [initialPreferences] = useState<CalculatorPreferences>(() => readCalculatorPreferences());
  const [inputMode, setInputMode] = useState<InputMode>(initialPreferences.inputMode);
  const [imperialNotation, setImperialNotation] = useState<ImperialNotation>(initialPreferences.imperialNotation);
  const [fractionLayout, setFractionLayout] = useState<FractionLayout>(initialPreferences.fractionLayout);
  const [heavyLightMode, setHeavyLightMode] = useState<HeavyLightMode>(initialPreferences.heavyLightMode);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(initialPreferences.imperialNotation === "feet-inches" ? "feet" : "inches");
  const [feetText, setFeetText] = useState("0");
  const [inchesText, setInchesText] = useState("0");
  const [fraction32, setFraction32] = useState(0);
  const [metricText, setMetricText] = useState("0");
  const [metricTenths, setMetricTenths] = useState(0);
  const [accumulatorUnits, setAccumulatorUnits] = useState<number | null>(null);
  const [accumulatorQualifier, setAccumulatorQualifier] = useState<TapeQualifier>("exact");
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [resultUnits, setResultUnits] = useState<number | null>(null);
  const [entryQualifier, setEntryQualifier] = useState<TapeQualifier>("exact");
  const [resultQualifier, setResultQualifier] = useState<TapeQualifier>("exact");
  const [historyLabel, setHistoryLabel] = useState("Ready");
  const [calculationHistory, setCalculationHistory] = useState<CalculationHistoryEntry[]>(() => readCalculatorHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const entryValueUnits = inputMode === "metric"
    ? valueFromMetricEntry(metricText, metricTenths)
    : valueFromImperialEntry(feetText, inchesText, fraction32);
  const displayValueUnits = resultUnits ?? entryValueUnits;
  const displayQualifier = resultUnits === null ? entryQualifier : resultQualifier;
  const fractionButtons = fractionLayout === "grouped" ? GROUPED_FRACTION_BUTTONS : FRACTION_BUTTONS;

  useEffect(() => {
    try {
      localStorage.setItem(CALCULATOR_PREFS_KEY, JSON.stringify({
        inputMode,
        imperialNotation,
        fractionLayout,
        heavyLightMode,
      } satisfies CalculatorPreferences));
    } catch { /* harmless preference */ }
  }, [fractionLayout, heavyLightMode, imperialNotation, inputMode]);

  useEffect(() => {
    try { localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(calculationHistory)); } catch { /* harmless device history */ }
  }, [calculationHistory]);

  function recordCalculation(
    expression: string,
    nextResultUnits: number,
    qualifier: TapeQualifier = "exact",
    mode = inputMode,
  ) {
    const nextEntry: CalculationHistoryEntry = {
      id: `${mode}:${activeUnit}:${expression}:${Math.round(nextResultUnits)}`,
      expression,
      resultUnits: nextResultUnits,
      inputMode: mode,
      activeUnit: mode === "imperial" ? activeUnit : undefined,
      qualifier: mode === "imperial" ? qualifier : undefined,
    };
    setCalculationHistory((current) => [
      nextEntry,
      ...current.filter((entry) => entry.expression !== expression || entry.resultUnits !== nextResultUnits),
    ].slice(0, CALCULATOR_HISTORY_LIMIT));
  }

  function setImperialEntryFromValue(nextUnits: number, unit = activeUnit) {
    const fields = fieldsFromImperialValue(nextUnits, unit);
    setFeetText(fields.feet);
    setInchesText(fields.inches);
    setFraction32(fields.fraction32);
  }

  function setMetricEntryFromValue(nextUnits: number) {
    const fields = fieldsFromMetricValue(nextUnits);
    setMetricText(fields.metricText);
    setMetricTenths(fields.metricTenths);
  }

  function setEntryFromValue(nextUnits: number, mode = inputMode, qualifier: TapeQualifier = "exact") {
    if (mode === "metric") {
      setMetricEntryFromValue(nextUnits);
    } else {
      setImperialEntryFromValue(nextUnits);
    }
    setResultUnits(null);
    setEntryQualifier(mode === "imperial" ? qualifier : "exact");
    setResultQualifier("exact");
  }

  function switchMode(nextMode: InputMode) {
    if (nextMode === inputMode) return;
    const base = displayValueUnits;
    setInputMode(nextMode);
    if (nextMode === "metric") {
      setMetricEntryFromValue(base);
    } else {
      const nextUnit = imperialNotation === "feet-inches" ? activeUnit : "inches";
      setActiveUnit(nextUnit);
      setImperialEntryFromValue(base, nextUnit);
    }
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setCopied(false);
  }

  function switchActiveUnit(nextUnit: ActiveUnit) {
    if (imperialNotation === "inches") return;
    if (nextUnit === activeUnit) return;
    setActiveUnit(nextUnit);
    setImperialEntryFromValue(displayValueUnits, nextUnit);
    setCopied(false);
  }

  function setNotation(nextNotation: ImperialNotation) {
    setImperialNotation(nextNotation);
    if (nextNotation === "inches" && activeUnit !== "inches") {
      const base = displayValueUnits;
      setActiveUnit("inches");
      setImperialEntryFromValue(base, "inches");
    }
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
      setEntryQualifier("exact");
      setResultQualifier("exact");
      setCopied(false);
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => {
      const clean = current === "0" ? "" : current;
      const next = `${clean}${digit}`.slice(0, activeUnit === "feet" ? 3 : 5);
      return next || "0";
    });
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
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
      setEntryQualifier("exact");
      setResultQualifier("exact");
      return;
    }

    if (fraction32) {
      setFraction32(0);
      setResultUnits(null);
      setEntryQualifier("exact");
      setResultQualifier("exact");
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => current.length > 1 ? current.slice(0, -1) : "0");
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
  }

  function clearAll() {
    setFeetText("0");
    setInchesText("0");
    setFraction32(0);
    setMetricText("0");
    setMetricTenths(0);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setPendingOperator(null);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setHistoryLabel("Ready");
    setCopied(false);
  }

  function applyHeavyLight(nextQualifier: TapeQualifier) {
    if (inputMode === "metric") {
      const delta = nextQualifier === "heavy" ? METRIC_TRIM_UNITS : -METRIC_TRIM_UNITS;
      const base = resultUnits ?? entryValueUnits;
      setEntryFromValue(Math.max(0, base + delta));
      setHistoryLabel(nextQualifier === "heavy" ? "Heavy +0.5 mm" : "Light -0.5 mm");
      setCopied(false);
      return;
    }

    if (heavyLightMode === "thirty-seconds") {
      const delta = nextQualifier === "heavy" ? IMPERIAL_TRIM_UNITS : -IMPERIAL_TRIM_UNITS;
      const base = resultUnits ?? entryValueUnits;
      setEntryFromValue(Math.max(0, base + delta));
      setHistoryLabel(nextQualifier === "heavy" ? "Heavy +1/32" : "Light -1/32");
      setCopied(false);
      return;
    }

    const qualifier = displayQualifier === nextQualifier ? "exact" : nextQualifier;
    setEntryFromValue(displayValueUnits, "imperial", qualifier);
    setHistoryLabel(qualifier === "exact" ? "Exact sixteenth" : `${qualifier === "heavy" ? "Heavy" : "Light"} tape mark`);
    setCopied(false);
  }

  function scaleEntry(multiplier: number) {
    const base = resultUnits ?? entryValueUnits;
    const qualifier = displayQualifier;
    if (inputMode === "imperial" && heavyLightMode === "tape" && qualifier !== "exact" && multiplier === 0.5) {
      setHistoryLabel("Switch to 32nd precision to halve an H/L mark.");
      return;
    }
    const next = inputMode === "imperial" && heavyLightMode === "tape" && qualifier !== "exact" && multiplier === 2
      ? Math.max(0, Math.round(base * multiplier + qualifierValue(qualifier) * UNITS_PER_SIXTEENTH))
      : Math.max(0, Math.round(base * multiplier));
    const expression = `${formatForMode(base, inputMode, activeUnit, qualifier)} ${multiplier === 2 ? "× 2" : "÷ 2"}`;
    setEntryFromValue(next);
    setHistoryLabel(expression);
    recordCalculation(expression, next);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setPendingOperator(null);
    setCopied(false);
  }

  function chooseFraction(sixteenth: number) {
    setFraction32(sixteenth * 2);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setCopied(false);
  }

  function chooseMetricTenth(tenth: number) {
    setMetricTenths(tenth);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setCopied(false);
  }

  function applyOperator(operator: Operator) {
    const current = resultUnits ?? entryValueUnits;
    const currentQualifier = displayQualifier;
    const nextAccumulator = accumulatorUnits !== null && pendingOperator
      ? inputMode === "imperial" && heavyLightMode === "tape"
        ? computeImperialTapeOperation(accumulatorUnits, accumulatorQualifier, pendingOperator, current, currentQualifier)
        : { units: computeOperation(accumulatorUnits, pendingOperator, current, inputMode), qualifier: "exact" as const }
      : { units: current, qualifier: currentQualifier };

    setAccumulatorUnits(nextAccumulator.units);
    setAccumulatorQualifier(nextAccumulator.qualifier);
    setPendingOperator(operator);
    setHistoryLabel(`${formatForMode(nextAccumulator.units, inputMode, activeUnit, nextAccumulator.qualifier)} ${formatOperator(operator)}`);
    setEntryFromValue(0);
  }

  function evaluate() {
    const current = resultUnits ?? entryValueUnits;
    const currentQualifier = displayQualifier;
    if (accumulatorUnits === null || !pendingOperator) {
      setResultUnits(current);
      setResultQualifier(currentQualifier);
      setHistoryLabel(formatForMode(current, inputMode, activeUnit, currentQualifier));
      return;
    }

    const nextResult = inputMode === "imperial" && heavyLightMode === "tape"
      ? computeImperialTapeOperation(accumulatorUnits, accumulatorQualifier, pendingOperator, current, currentQualifier)
      : { units: computeOperation(accumulatorUnits, pendingOperator, current, inputMode), qualifier: "exact" as const };
    const expression = `${formatForMode(accumulatorUnits, inputMode, activeUnit, accumulatorQualifier)} ${formatOperator(pendingOperator)} ${formatForMode(current, inputMode, activeUnit, currentQualifier)}`;
    setResultUnits(nextResult.units);
    setResultQualifier(nextResult.qualifier);
    setHistoryLabel(expression);
    recordCalculation(expression, nextResult.units, nextResult.qualifier);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setPendingOperator(null);
    setCopied(false);
  }

  async function copyCalculatorResult() {
    const text = inputMode === "metric"
      ? formatMillimeters(displayValueUnits)
      : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function reuseHistoryEntry(entry: CalculationHistoryEntry) {
    setInputMode(entry.inputMode);
    if (entry.inputMode === "metric") {
      setMetricEntryFromValue(entry.resultUnits);
    } else {
      const restoredUnit = entry.activeUnit ?? "inches";
      setActiveUnit(restoredUnit);
      setImperialEntryFromValue(entry.resultUnits, restoredUnit);
    }
    setAccumulatorUnits(null);
    setPendingOperator(null);
    setResultUnits(entry.resultUnits);
    setEntryQualifier(entry.qualifier ?? "exact");
    setResultQualifier(entry.qualifier ?? "exact");
    setHistoryLabel(entry.expression);
    setCopied(false);
    setHistoryOpen(false);
  }

  const primaryValue = inputMode === "metric" ? formatMillimeters(displayValueUnits) : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier);
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
        pendingOperator ? `${pendingOperator} pending` : displayQualifier === "exact" ? activeUnit === "feet" ? "Entering feet" : "Entering inches" : `${displayQualifier === "heavy" ? "Heavy" : "Light"} tape mark`,
      ];
  const resultCardPrimary = inputMode === "metric" ? formatMillimeters(displayValueUnits) : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier);
  const resultCardSecondaryLabel = inputMode === "metric" ? "Imperial" : "Metric";
  const resultCardSecondaryValue = inputMode === "metric"
    ? formatInchesMeasurement(displayValueUnits)
    : formatMillimeters(displayValueUnits);
  const equationLabel = accumulatorUnits !== null && pendingOperator
    ? `${formatForMode(accumulatorUnits, inputMode, activeUnit, accumulatorQualifier)} ${formatOperator(pendingOperator)} ${formatForMode(entryValueUnits, inputMode, activeUnit, entryQualifier)}`
    : historyLabel;

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
          <button type="button" className="calc-action-button" aria-label="Calculator settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={15} />
            <span className="calc-topbar-label">Settings</span>
          </button>
          <button type="button" className="calc-action-button" aria-label="Calculation history" onClick={() => setHistoryOpen(true)}>
            <Clock3 size={15} />
            <span className="calc-topbar-label">History</span>
          </button>
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
                <span className="fraction-history">{equationLabel}</span>
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
                    <button type="button" className="active unit-metric" aria-label="Millimetres input" aria-pressed="true">
                      <span>MM</span>
                      <strong>{formatMetricEntry(metricText, metricTenths).replace(" mm", "")}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" aria-label="Centimetres readout" tabIndex={-1}>
                      <span>CM</span>
                      <strong>{formatNumber(displayValueUnits / (UNITS_PER_MM * 10), 2)}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" aria-label="Metres readout" tabIndex={-1}>
                      <span>M</span>
                      <strong>{formatNumber(displayValueUnits / (UNITS_PER_MM * 1000), 3)}</strong>
                    </button>
                    <button
                      type="button"
                      className="unit-metric"
                      aria-label="Open calculator settings"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <span>MODE</span>
                      <strong>MM</strong>
                    </button>
                  </>
                ) : (
                  <>
                    {imperialNotation === "feet-inches" ? (
                      <button type="button" className={activeUnit === "feet" ? "active unit-feet" : "unit-feet"} aria-label="Feet input" onClick={() => switchActiveUnit("feet")}>
                        <span>FT</span>
                        <strong>{feetText}</strong>
                      </button>
                    ) : null}
                    <button type="button" className={`${activeUnit === "inches" ? "active " : ""}unit-inches${imperialNotation === "inches" ? " unit-inches-only" : ""}`} aria-label="Inches input" onClick={() => switchActiveUnit("inches")}>
                      <span>IN</span>
                      <strong>{inchesText}</strong>
                    </button>
                    <button type="button" className={fraction32 ? "active unit-fraction" : "unit-fraction"} aria-label="Fraction input" onClick={() => { setFraction32(0); setEntryQualifier("exact"); setResultQualifier("exact"); }}>
                      <span>FRAC</span>
                      <strong>{reduceFraction(fraction32) || "--"}</strong>
                    </button>
                    <button
                      type="button"
                      className="unit-metric"
                      aria-label="Open calculator settings"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <span>SET</span>
                      <strong>{imperialNotation === "inches" ? "IN" : "FT"}</strong>
                    </button>
                  </>
                )}
              </div>

              <div className="fraction-action-row" aria-label="Heavy, light, double, and half controls">
                <button
                  type="button"
                  aria-label={inputMode === "metric" ? "Light minus half millimetre" : heavyLightMode === "tape" ? "Mark measurement light" : "Light minus one thirty-second"}
                  aria-pressed={inputMode === "imperial" && heavyLightMode === "tape" && displayQualifier === "light"}
                  onClick={() => applyHeavyLight("light")}
                >
                  <strong>L</strong>
                  <small>{inputMode === "metric" ? "-0.5 mm" : "Light"}</small>
                </button>
                <button
                  type="button"
                  aria-label={inputMode === "metric" ? "Heavy plus half millimetre" : heavyLightMode === "tape" ? "Mark measurement heavy" : "Heavy plus one thirty-second"}
                  aria-pressed={inputMode === "imperial" && heavyLightMode === "tape" && displayQualifier === "heavy"}
                  onClick={() => applyHeavyLight("heavy")}
                >
                  <strong>H</strong>
                  <small>{inputMode === "metric" ? "+0.5 mm" : "Heavy"}</small>
                </button>
                <button type="button" aria-label="Divide measurement by two" onClick={() => scaleEntry(0.5)} disabled={inputMode === "imperial" && heavyLightMode === "tape" && displayQualifier !== "exact"}>
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
                  {fractionButtons.map((value) => {
                    const family = fractionFamilyFromSixteenth(value);
                    const label = fractionLabelFromSixteenth(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        data-fraction-family={family}
                        className={`${fraction32 === value * 2 ? "active " : ""}fraction-${family}`}
                        aria-label={`Enter ${label} ${family} tape mark`}
                        onClick={() => chooseFraction(value)}
                      >
                        {label}
                      </button>
                    );
                  })}
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
              onClick={() => { setFraction32(tick.value); setEntryQualifier("exact"); setResultQualifier("exact"); }}
            >
              {tick.label}
            </button>
          ))}
        </aside>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? `${primaryValue} copied` : ""}</span>
      {settingsOpen ? createPortal(
        <DialogBackdrop className="calc-history-backdrop" onClose={() => setSettingsOpen(false)}>
          <DialogSurface className="calc-history-sheet calc-settings-sheet" labelledBy="calc-settings-title" onClose={() => setSettingsOpen(false)}>
            <header>
              <div>
                <span>Calculator tape</span>
                <h2 id="calc-settings-title">Calculator settings</h2>
              </div>
              <button type="button" className="v2-icon-button" aria-label="Close calculator settings" onClick={() => setSettingsOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="calc-settings-list">
              <section>
                <div>
                  <strong>Measurement mode</strong>
                  <span>Keep the unit system you use on site.</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label="Measurement mode">
                  <button type="button" className={inputMode === "imperial" ? "active" : ""} onClick={() => switchMode("imperial")}>Imperial</button>
                  <button type="button" className={inputMode === "metric" ? "active" : ""} onClick={() => switchMode("metric")}>Metric</button>
                </div>
              </section>
              <section>
                <div>
                  <strong>Imperial notation</strong>
                  <span>Choose whether long measurements stay in inches.</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label="Imperial notation">
                  <button type="button" className={imperialNotation === "inches" ? "active" : ""} onClick={() => setNotation("inches")}>Inches only</button>
                  <button type="button" className={imperialNotation === "feet-inches" ? "active" : ""} onClick={() => setNotation("feet-inches")}>Feet + inches</button>
                </div>
              </section>
              <section>
                <div>
                  <strong>Fraction keys</strong>
                  <span>Keep tape order or bring larger tape marks forward.</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label="Fraction key layout">
                  <button type="button" className={fractionLayout === "tape" ? "active" : ""} onClick={() => setFractionLayout("tape")}>Tape order</button>
                  <button type="button" className={fractionLayout === "grouped" ? "active" : ""} onClick={() => setFractionLayout("grouped")}>Grouped marks</button>
                </div>
              </section>
              <section>
                <div>
                  <strong>Heavy / Light</strong>
                  <span>{heavyLightMode === "tape" ? "One mark stays visible. Two matching marks resolve to a sixteenth." : "Each mark adjusts the result by one thirty-second."}</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label="Heavy and light behavior">
                  <button type="button" className={heavyLightMode === "tape" ? "active" : ""} onClick={() => setHeavyLightMode("tape")}>Tape qualifier</button>
                  <button type="button" className={heavyLightMode === "thirty-seconds" ? "active" : ""} onClick={() => setHeavyLightMode("thirty-seconds")}>32nd precision</button>
                </div>
              </section>
            </div>
          </DialogSurface>
        </DialogBackdrop>,
        document.body,
      ) : null}
      {historyOpen ? createPortal(
        <DialogBackdrop className="calc-history-backdrop" onClose={() => setHistoryOpen(false)}>
          <DialogSurface className="calc-history-sheet" labelledBy="calc-history-title" onClose={() => setHistoryOpen(false)}>
            <header>
              <div>
                <span>Calculator tape</span>
                <h2 id="calc-history-title">Recent calculations</h2>
              </div>
              <button type="button" className="v2-icon-button" aria-label="Close calculation history" onClick={() => setHistoryOpen(false)}>
                <X size={20} />
              </button>
            </header>
            {calculationHistory.length ? (
              <div className="calc-history-list">
                {calculationHistory.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => reuseHistoryEntry(entry)}>
                    <span>{entry.expression}</span>
                    <strong>{formatForMode(entry.resultUnits, entry.inputMode, entry.activeUnit ?? "inches", entry.qualifier ?? "exact")}</strong>
                    <small>Use result</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="calc-history-empty">
                <Clock3 size={22} />
                <strong>No calculations yet</strong>
                <span>Completed equations will stay on this device.</span>
              </div>
            )}
            {calculationHistory.length ? (
              <button type="button" className="calc-history-clear" onClick={() => setCalculationHistory([])}>
                <Trash2 size={17} />
                Clear history
              </button>
            ) : null}
          </DialogSurface>
        </DialogBackdrop>,
        document.body,
      ) : null}
    </section>
  );
}
