import { ArrowLeft, Check, Clipboard, Clock3, Copy, ListChecks, RotateCcw, Ruler, Settings2, Trash2, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DialogBackdrop, DialogSurface } from "../../components/ui";

type ActiveUnit = "feet" | "inches";
type InputMode = "imperial" | "metric";
type Operator = "+" | "-" | "x" | "/";
type TapeQualifier = "light" | "exact" | "heavy";
type ImperialNotation = "inches" | "feet-inches";
type FractionLayout = "tape" | "grouped";

const CALCULATOR_PREFS_KEY = "rivt.calculatorPrefs.v1";
const CALCULATOR_HISTORY_KEY = "rivt.calculatorHistory.v1";
const CALCULATOR_TAPE_LIST_KEY = "rivt.calculatorTapeList.v1";
const CALCULATOR_HISTORY_LIMIT = 8;
const CALCULATOR_TAPE_LIST_LIMIT = 60;
const UNITS_PER_MM = 160;
const UNITS_PER_INCH = 4064;
const UNITS_PER_FOOT = UNITS_PER_INCH * 12;
const UNITS_PER_THIRTY_SECOND = 127;
const UNITS_PER_SIXTEENTH = UNITS_PER_THIRTY_SECOND * 2;
const METRIC_TRIM_UNITS = UNITS_PER_MM / 2;
const FRACTION_BUTTONS = Array.from({ length: 15 }, (_, index) => index + 1);
const GROUPED_FRACTION_BUTTONS = [4, 8, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];
const METRIC_TENTH_BUTTONS = Array.from({ length: 9 }, (_, index) => index + 1);
const QUICK_ENTRY_HOLD_MS = 380;
const IMPERIAL_DIGIT_FRACTIONS: Record<string, number[]> = {
  "1": [1, 2, 4, 8],
  "2": [8],
  "3": [3, 6, 12],
  "4": [4, 8, 12],
  "5": [5, 10],
  "7": [7, 14],
  "8": [2, 6, 10, 14],
  "9": [9],
};
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
  approximate?: boolean;
};

type TapeMeasurementEntry = {
  id: string;
  resultUnits: number;
  inputMode: InputMode;
  activeUnit?: ActiveUnit;
  qualifier?: TapeQualifier;
  approximate?: boolean;
  used: boolean;
};

type TapePresentation = {
  units: number;
  qualifier: TapeQualifier;
  approximate: boolean;
};

type CalculatorPreferences = {
  inputMode: InputMode;
  imperialNotation: ImperialNotation;
  fractionLayout: FractionLayout;
  fractionKeysVisible: boolean;
};

type QuickEntryOption = {
  label: string;
  ariaLabel: string;
  value: number;
};

type QuickEntryMenuPosition = {
  left: number;
  bottom: number;
  width: number;
  arrowLeft: number;
};

function QuickEntryDigitKey({
  digit,
  options,
  menuLabel,
  onTap,
  onQuickEntry,
}: {
  digit: string;
  options: QuickEntryOption[];
  menuLabel: string;
  onTap: () => void;
  onQuickEntry: (value: number) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressResetTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<QuickEntryMenuPosition | null>(null);

  function openQuickEntry() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportWidth = window.innerWidth;
    const width = Math.min(320, viewportWidth - 24);
    const keyCenter = rect.left + rect.width / 2;
    const left = Math.min(Math.max(12, keyCenter - width / 2), viewportWidth - width - 12);
    const arrowLeft = Math.min(Math.max(18, keyCenter - left), width - 18);

    setMenuPosition({
      left,
      bottom: Math.max(12, window.innerHeight - rect.top + 10),
      width,
      arrowLeft,
    });
    setOpen(true);
  }

  function cancelHold() {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    pointerOriginRef.current = null;
  }

  function clearClickSuppression() {
    suppressClickRef.current = false;
    if (suppressResetTimerRef.current !== null) {
      window.clearTimeout(suppressResetTimerRef.current);
      suppressResetTimerRef.current = null;
    }
  }

  useEffect(() => () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    if (suppressResetTimerRef.current !== null) window.clearTimeout(suppressResetTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function closeOnViewportChange() {
      setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={options.length ? "has-quick-entry" : undefined}
        aria-haspopup={options.length ? "menu" : undefined}
        aria-expanded={options.length ? open : undefined}
        aria-label={options.length ? `${digit}. Hold for quick entry.` : digit}
        onPointerDown={(event) => {
          if (!options.length || event.button !== 0) return;
          pointerOriginRef.current = { x: event.clientX, y: event.clientY };
          holdTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            openQuickEntry();
            navigator.vibrate?.(12);
          }, QUICK_ENTRY_HOLD_MS);
        }}
        onPointerMove={(event) => {
          const origin = pointerOriginRef.current;
          if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 10) return;
          cancelHold();
        }}
        onPointerUp={() => {
          cancelHold();
          if (!suppressClickRef.current) return;
          suppressResetTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
            suppressResetTimerRef.current = null;
          }, 0);
        }}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        onDragStart={(event) => event.preventDefault()}
        onClick={() => {
          if (suppressClickRef.current) {
            clearClickSuppression();
            return;
          }
          onTap();
        }}
      >
        {digit}
        {options.length ? <span className="calc-hold-cue" aria-hidden="true" /> : null}
      </button>
      {open && menuPosition ? createPortal(
        <div className="calc-quick-entry-layer" role="presentation" onPointerDown={() => setOpen(false)}>
          <div
            className="calc-quick-entry-menu"
            role="menu"
            aria-label={menuLabel}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: menuPosition.left,
              bottom: menuPosition.bottom,
              width: menuPosition.width,
              "--calc-quick-arrow-left": `${menuPosition.arrowLeft}px`,
            } as CSSProperties}
          >
            <span>{menuLabel}</span>
            <div>
              {options.map((option) => (
                <button
                  key={`${digit}-${option.label}`}
                  type="button"
                  role="menuitem"
                  aria-label={option.ariaLabel}
                  onClick={() => {
                    clearClickSuppression();
                    onQuickEntry(option.value);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <small>Tap the value you want</small>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

const DEFAULT_CALCULATOR_PREFERENCES: CalculatorPreferences = {
  inputMode: "imperial",
  imperialNotation: "inches",
  fractionLayout: "tape",
  fractionKeysVisible: true,
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

function roundToSixteenth(units: number) {
  return Math.round(units / UNITS_PER_SIXTEENTH) * UNITS_PER_SIXTEENTH;
}

function qualifierValue(qualifier: TapeQualifier) {
  if (qualifier === "heavy") return 1;
  if (qualifier === "light") return -1;
  return 0;
}

function exactTapeUnits(units: number, qualifier: TapeQualifier) {
  return units + qualifierValue(qualifier) * UNITS_PER_THIRTY_SECOND;
}

function presentationFromExactUnits(exactUnits: number, preferredAnchorUnits?: number): TapePresentation {
  const safeUnits = Math.max(0, exactUnits);
  const roundedThirtySecond = Math.round(safeUnits / UNITS_PER_THIRTY_SECOND);
  const roundedUnits = roundedThirtySecond * UNITS_PER_THIRTY_SECOND;
  const approximate = Math.abs(safeUnits - roundedUnits) > 0.5;

  if (roundedThirtySecond % 2 === 0) {
    return {
      units: roundedUnits,
      qualifier: "exact",
      approximate,
    };
  }

  if (preferredAnchorUnits !== undefined) {
    const preferredMark = Math.round(preferredAnchorUnits / UNITS_PER_THIRTY_SECOND);
    if (preferredMark % 2 === 0 && Math.abs(preferredMark - roundedThirtySecond) === 1) {
      return {
        units: preferredMark * UNITS_PER_THIRTY_SECOND,
        qualifier: roundedThirtySecond > preferredMark ? "heavy" : "light",
        approximate,
      };
    }
  }

  return {
    units: (roundedThirtySecond - 1) * UNITS_PER_THIRTY_SECOND,
    qualifier: "heavy",
    approximate,
  };
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
  const safeValue = Math.abs(roundToSixteenth(units));
  const totalSixteenths = Math.round(safeValue / UNITS_PER_SIXTEENTH);
  const totalInches = Math.floor(totalSixteenths / 16);
  const fraction32 = (totalSixteenths % 16) * 2;
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
  const safeValue = Math.abs(roundToSixteenth(units));
  const totalSixteenths = Math.round(safeValue / UNITS_PER_SIXTEENTH);
  const totalInches = Math.floor(totalSixteenths / 16);
  const fraction = reduceFraction((totalSixteenths % 16) * 2);
  return `${sign}${totalInches}${fraction ? ` ${fraction}` : ""}"`;
}

function formatImperialMeasurement(
  units: number,
  activeUnit: ActiveUnit,
  qualifier: TapeQualifier = "exact",
  approximate = false,
) {
  const measurement = activeUnit === "feet" ? formatMeasurement(units) : formatInchesMeasurement(units);
  const tapeMeasurement = qualifier === "exact" ? measurement : `${measurement} ${qualifier === "heavy" ? "H" : "L"}`;
  return approximate ? `≈ ${tapeMeasurement}` : tapeMeasurement;
}

function valueFromImperialEntry(feetText: string, inchesText: string, fraction32: number) {
  const feet = Math.max(0, Number(feetText) || 0);
  const inches = Math.max(0, Number(inchesText) || 0);
  return feet * UNITS_PER_FOOT + inches * UNITS_PER_INCH + fraction32 * UNITS_PER_THIRTY_SECOND;
}

function fieldsFromImperialValue(units: number, activeUnit: ActiveUnit) {
  const safeValue = Math.max(0, roundToSixteenth(units));
  const totalSixteenths = Math.round(safeValue / UNITS_PER_SIXTEENTH);
  const totalInches = Math.floor(totalSixteenths / 16);
  const fraction32 = (totalSixteenths % 16) * 2;
  if (activeUnit === "inches") {
    return {
      feet: "0",
      inches: String(totalInches),
      fraction32,
    };
  }
  return {
    feet: String(Math.floor(totalInches / 12)),
    inches: String(totalInches % 12),
    fraction32,
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

function computeImperialTapeOperation(
  leftUnits: number,
  leftQualifier: TapeQualifier,
  operator: Operator,
  rightUnits: number,
  rightQualifier: TapeQualifier,
  inputApproximate = false,
) {
  if (operator === "x" || operator === "/") {
    const leftExact = exactTapeUnits(leftUnits, leftQualifier);
    const rightExact = exactTapeUnits(rightUnits, rightQualifier);
    const scalar = rightExact / UNITS_PER_INCH;
    if (!scalar) return { units: leftUnits, qualifier: leftQualifier, approximate: inputApproximate };
    const exactResult = operator === "x" ? leftExact * scalar : leftExact / scalar;
    const presentation = presentationFromExactUnits(exactResult);
    return { ...presentation, approximate: inputApproximate || presentation.approximate };
  }

  const direction = operator === "+" ? 1 : -1;
  const preferredAnchor = leftUnits + direction * rightUnits;
  const exactResult = exactTapeUnits(leftUnits, leftQualifier) + direction * exactTapeUnits(rightUnits, rightQualifier);
  const presentation = presentationFromExactUnits(exactResult, preferredAnchor);
  return { ...presentation, approximate: inputApproximate || presentation.approximate };
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
  approximate = false,
) {
  return mode === "metric" ? formatMillimeters(units) : formatImperialMeasurement(units, activeUnit, qualifier, approximate);
}

function readCalculatorPreferences(): CalculatorPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALCULATOR_PREFS_KEY) ?? "null") as Partial<CalculatorPreferences> | null;
    return {
      inputMode: parsed?.inputMode === "metric" ? "metric" : "imperial",
      imperialNotation: parsed?.imperialNotation === "feet-inches" ? "feet-inches" : "inches",
      fractionLayout: parsed?.fractionLayout === "grouped" ? "grouped" : "tape",
      fractionKeysVisible: parsed?.fractionKeysVisible !== false,
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

function readTapeMeasurements(): TapeMeasurementEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALCULATOR_TAPE_LIST_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is TapeMeasurementEntry => {
        if (!entry || typeof entry !== "object") return false;
        const candidate = entry as Partial<TapeMeasurementEntry>;
        return typeof candidate.id === "string"
          && typeof candidate.resultUnits === "number"
          && Number.isFinite(candidate.resultUnits)
          && (candidate.inputMode === "imperial" || candidate.inputMode === "metric")
          && typeof candidate.used === "boolean";
      })
      .slice(-CALCULATOR_TAPE_LIST_LIMIT);
  } catch {
    return [];
  }
}

export function FieldCalculatorTool({ onBack }: { onBack?: () => void }) {
  const [initialPreferences] = useState<CalculatorPreferences>(() => readCalculatorPreferences());
  const [inputMode, setInputMode] = useState<InputMode>(initialPreferences.inputMode);
  const [imperialNotation, setImperialNotation] = useState<ImperialNotation>(initialPreferences.imperialNotation);
  const [fractionLayout, setFractionLayout] = useState<FractionLayout>(initialPreferences.fractionLayout);
  const [fractionKeysVisible, setFractionKeysVisible] = useState(initialPreferences.fractionKeysVisible);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(initialPreferences.imperialNotation === "feet-inches" ? "feet" : "inches");
  const [feetText, setFeetText] = useState("0");
  const [inchesText, setInchesText] = useState("0");
  const [fraction32, setFraction32] = useState(0);
  const [metricText, setMetricText] = useState("0");
  const [metricTenths, setMetricTenths] = useState(0);
  const [accumulatorUnits, setAccumulatorUnits] = useState<number | null>(null);
  const [accumulatorQualifier, setAccumulatorQualifier] = useState<TapeQualifier>("exact");
  const [accumulatorApproximate, setAccumulatorApproximate] = useState(false);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [resultUnits, setResultUnits] = useState<number | null>(null);
  const [entryQualifier, setEntryQualifier] = useState<TapeQualifier>("exact");
  const [resultQualifier, setResultQualifier] = useState<TapeQualifier>("exact");
  const [entryApproximate, setEntryApproximate] = useState(false);
  const [resultApproximate, setResultApproximate] = useState(false);
  const [historyLabel, setHistoryLabel] = useState("Ready");
  const [calculationHistory, setCalculationHistory] = useState<CalculationHistoryEntry[]>(() => readCalculatorHistory());
  const [tapeMeasurements, setTapeMeasurements] = useState<TapeMeasurementEntry[]>(() => readTapeMeasurements());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const entryValueUnits = inputMode === "metric"
    ? valueFromMetricEntry(metricText, metricTenths)
    : valueFromImperialEntry(feetText, inchesText, fraction32);
  const displayValueUnits = resultUnits ?? entryValueUnits;
  const displayQualifier = resultUnits === null ? entryQualifier : resultQualifier;
  const displayApproximate = resultUnits === null ? entryApproximate : resultApproximate;
  const displayExactUnits = inputMode === "imperial"
    ? exactTapeUnits(displayValueUnits, displayQualifier)
    : displayValueUnits;
  const fractionButtons = fractionLayout === "grouped" ? GROUPED_FRACTION_BUTTONS : FRACTION_BUTTONS;

  useEffect(() => {
    try {
      localStorage.setItem(CALCULATOR_PREFS_KEY, JSON.stringify({
        inputMode,
        imperialNotation,
        fractionLayout,
        fractionKeysVisible,
      } satisfies CalculatorPreferences));
    } catch { /* harmless preference */ }
  }, [fractionKeysVisible, fractionLayout, imperialNotation, inputMode]);

  useEffect(() => {
    try { localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(calculationHistory)); } catch { /* harmless device history */ }
  }, [calculationHistory]);

  useEffect(() => {
    try { localStorage.setItem(CALCULATOR_TAPE_LIST_KEY, JSON.stringify(tapeMeasurements)); } catch { /* harmless device tape list */ }
  }, [tapeMeasurements]);

  function recordCalculation(
    expression: string,
    nextResultUnits: number,
    qualifier: TapeQualifier = "exact",
    mode = inputMode,
    approximate = false,
  ) {
    const nextEntry: CalculationHistoryEntry = {
      id: `${mode}:${activeUnit}:${expression}:${Math.round(nextResultUnits)}`,
      expression,
      resultUnits: nextResultUnits,
      inputMode: mode,
      activeUnit: mode === "imperial" ? activeUnit : undefined,
      qualifier: mode === "imperial" ? qualifier : undefined,
      approximate: mode === "imperial" ? approximate : undefined,
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

  function setEntryFromValue(
    nextUnits: number,
    mode = inputMode,
    qualifier: TapeQualifier = "exact",
    approximate = false,
  ) {
    if (mode === "metric") {
      setMetricEntryFromValue(nextUnits);
    } else {
      setImperialEntryFromValue(nextUnits);
    }
    setResultUnits(null);
    setEntryQualifier(mode === "imperial" ? qualifier : "exact");
    setResultQualifier("exact");
    setEntryApproximate(mode === "imperial" ? approximate : false);
    setResultApproximate(false);
  }

  function switchMode(nextMode: InputMode) {
    if (nextMode === inputMode) return;
    const base = displayExactUnits;
    setInputMode(nextMode);
    if (nextMode === "metric") {
      setMetricEntryFromValue(base);
      setEntryQualifier("exact");
      setEntryApproximate(false);
    } else {
      const nextUnit = imperialNotation === "feet-inches" ? activeUnit : "inches";
      const presentation = presentationFromExactUnits(base);
      setActiveUnit(nextUnit);
      setImperialEntryFromValue(presentation.units, nextUnit);
      setEntryQualifier(presentation.qualifier);
      setEntryApproximate(presentation.approximate);
    }
    setResultUnits(null);
    setResultQualifier("exact");
    setResultApproximate(false);
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
      setEntryApproximate(false);
      setResultApproximate(false);
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
    setEntryApproximate(false);
    setResultApproximate(false);
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
      setEntryApproximate(false);
      setResultApproximate(false);
      return;
    }

    if (fraction32) {
      setFraction32(0);
      setResultUnits(null);
      setEntryQualifier("exact");
      setResultQualifier("exact");
      setEntryApproximate(false);
      setResultApproximate(false);
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => current.length > 1 ? current.slice(0, -1) : "0");
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
  }

  function clearAll() {
    setFeetText("0");
    setInchesText("0");
    setFraction32(0);
    setMetricText("0");
    setMetricTenths(0);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setAccumulatorApproximate(false);
    setPendingOperator(null);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
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

    const qualifier = displayQualifier === nextQualifier ? "exact" : nextQualifier;
    setEntryFromValue(displayValueUnits, "imperial", qualifier);
    setHistoryLabel(qualifier === "exact" ? "Exact sixteenth" : `${qualifier === "heavy" ? "Heavy" : "Light"} tape mark`);
    setCopied(false);
  }

  function scaleEntry(multiplier: number) {
    const base = resultUnits ?? entryValueUnits;
    const qualifier = displayQualifier;
    const expression = `${formatForMode(base, inputMode, activeUnit, qualifier, displayApproximate)} ${multiplier === 2 ? "× 2" : "÷ 2"}`;
    if (inputMode === "imperial") {
      const presentation = presentationFromExactUnits(exactTapeUnits(base, qualifier) * multiplier);
      const approximate = displayApproximate || presentation.approximate;
      setEntryFromValue(presentation.units, "imperial", presentation.qualifier, approximate);
      recordCalculation(expression, presentation.units, presentation.qualifier, "imperial", approximate);
    } else {
      const next = Math.max(0, Math.round(base * multiplier));
      setEntryFromValue(next);
      recordCalculation(expression, next);
    }
    setHistoryLabel(expression);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setAccumulatorApproximate(false);
    setPendingOperator(null);
    setCopied(false);
  }

  function chooseFraction(sixteenth: number) {
    setFraction32(sixteenth * 2);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
    setCopied(false);
  }

  function chooseMetricTenth(tenth: number) {
    setMetricTenths(tenth);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
    setCopied(false);
  }

  function quickEntryOptions(digit: string): QuickEntryOption[] {
    if (inputMode === "metric") {
      if (digit === "0") return [];
      return [{ label: `.${digit} mm`, ariaLabel: `Enter point ${digit} millimeters`, value: Number(digit) }];
    }

    const values = fractionKeysVisible ? (IMPERIAL_DIGIT_FRACTIONS[digit] ?? []) : FRACTION_BUTTONS;
    return values.map((value) => {
      const label = fractionLabelFromSixteenth(value);
      return { label, ariaLabel: `Enter ${label}`, value };
    });
  }

  function applyOperator(operator: Operator) {
    const current = resultUnits ?? entryValueUnits;
    const currentQualifier = displayQualifier;
    const currentApproximate = displayApproximate;
    const nextAccumulator = accumulatorUnits !== null && pendingOperator
      ? inputMode === "imperial"
        ? computeImperialTapeOperation(
            accumulatorUnits,
            accumulatorQualifier,
            pendingOperator,
            current,
            currentQualifier,
            accumulatorApproximate || currentApproximate,
          )
        : {
            units: computeOperation(accumulatorUnits, pendingOperator, current, inputMode),
            qualifier: "exact" as const,
            approximate: false,
          }
      : { units: current, qualifier: currentQualifier, approximate: currentApproximate };

    setAccumulatorUnits(nextAccumulator.units);
    setAccumulatorQualifier(nextAccumulator.qualifier);
    setAccumulatorApproximate(nextAccumulator.approximate);
    setPendingOperator(operator);
    setHistoryLabel(`${formatForMode(nextAccumulator.units, inputMode, activeUnit, nextAccumulator.qualifier, nextAccumulator.approximate)} ${formatOperator(operator)}`);
    setEntryFromValue(0);
  }

  function evaluate() {
    const current = resultUnits ?? entryValueUnits;
    const currentQualifier = displayQualifier;
    const currentApproximate = displayApproximate;
    if (accumulatorUnits === null || !pendingOperator) {
      const currentExactUnits = inputMode === "imperial"
        ? exactTapeUnits(current, currentQualifier)
        : current;
      if (currentExactUnits <= 0) {
        setHistoryLabel("Enter a measurement before adding it");
        return;
      }
      setTapeMeasurements((entries) => [...entries, {
        id: crypto.randomUUID(),
        resultUnits: current,
        inputMode,
        activeUnit: inputMode === "imperial" ? activeUnit : undefined,
        qualifier: inputMode === "imperial" ? currentQualifier : undefined,
        approximate: inputMode === "imperial" ? currentApproximate : undefined,
        used: false,
      }].slice(-CALCULATOR_TAPE_LIST_LIMIT));
      setResultUnits(current);
      setResultQualifier(currentQualifier);
      setResultApproximate(currentApproximate);
      setHistoryLabel(`Added ${formatForMode(current, inputMode, activeUnit, currentQualifier, currentApproximate)} to Tape List`);
      return;
    }

    const nextResult = inputMode === "imperial"
      ? computeImperialTapeOperation(
          accumulatorUnits,
          accumulatorQualifier,
          pendingOperator,
          current,
          currentQualifier,
          accumulatorApproximate || currentApproximate,
        )
      : {
          units: computeOperation(accumulatorUnits, pendingOperator, current, inputMode),
          qualifier: "exact" as const,
          approximate: false,
        };
    const expression = `${formatForMode(accumulatorUnits, inputMode, activeUnit, accumulatorQualifier, accumulatorApproximate)} ${formatOperator(pendingOperator)} ${formatForMode(current, inputMode, activeUnit, currentQualifier, currentApproximate)}`;
    setResultUnits(nextResult.units);
    setResultQualifier(nextResult.qualifier);
    setResultApproximate(nextResult.approximate);
    setHistoryLabel(expression);
    recordCalculation(expression, nextResult.units, nextResult.qualifier, inputMode, nextResult.approximate);
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setAccumulatorApproximate(false);
    setPendingOperator(null);
    setCopied(false);
  }

  async function copyCalculatorResult() {
    const text = inputMode === "metric"
      ? formatMillimeters(displayValueUnits)
      : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier, displayApproximate);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function formatTapeMeasurement(entry: TapeMeasurementEntry) {
    return formatForMode(
      entry.resultUnits,
      entry.inputMode,
      entry.activeUnit ?? "inches",
      entry.qualifier ?? "exact",
      entry.approximate ?? false,
    );
  }

  function toggleTapeMeasurement(entryId: string) {
    setTapeMeasurements((entries) => entries.map((entry) => (
      entry.id === entryId ? { ...entry, used: !entry.used } : entry
    )));
  }

  function reuseTapeMeasurement(entry: TapeMeasurementEntry, closeHistory = false) {
    setInputMode(entry.inputMode);
    if (entry.inputMode === "metric") {
      setMetricEntryFromValue(entry.resultUnits);
    } else {
      const restoredUnit = entry.activeUnit ?? "inches";
      setActiveUnit(restoredUnit);
      setImperialNotation(restoredUnit === "feet" ? "feet-inches" : imperialNotation);
      setImperialEntryFromValue(entry.resultUnits, restoredUnit);
    }
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setAccumulatorApproximate(false);
    setPendingOperator(null);
    setResultUnits(entry.resultUnits);
    setEntryQualifier(entry.qualifier ?? "exact");
    setResultQualifier(entry.qualifier ?? "exact");
    setEntryApproximate(entry.approximate ?? false);
    setResultApproximate(entry.approximate ?? false);
    setHistoryLabel("Loaded from Tape List");
    setCopied(false);
    if (closeHistory) setHistoryOpen(false);
  }

  function reuseHistoryEntry(entry: CalculationHistoryEntry) {
    setInputMode(entry.inputMode);
    if (entry.inputMode === "metric") {
      setMetricEntryFromValue(entry.resultUnits);
    } else {
      const restoredUnit = entry.activeUnit ?? "inches";
      setActiveUnit(restoredUnit);
      setImperialNotation(restoredUnit === "feet" ? "feet-inches" : imperialNotation);
      setImperialEntryFromValue(entry.resultUnits, restoredUnit);
    }
    setAccumulatorUnits(null);
    setAccumulatorQualifier("exact");
    setAccumulatorApproximate(false);
    setPendingOperator(null);
    setResultUnits(entry.resultUnits);
    setEntryQualifier(entry.qualifier ?? "exact");
    setResultQualifier(entry.qualifier ?? "exact");
    setEntryApproximate(entry.approximate ?? false);
    setResultApproximate(entry.approximate ?? false);
    setHistoryLabel(entry.expression);
    setCopied(false);
    setHistoryOpen(false);
  }

  function renderTapeMeasurementRow(entry: TapeMeasurementEntry, closeHistory = false) {
    const measurementNumber = tapeMeasurements.findIndex((candidate) => candidate.id === entry.id) + 1;
    const measurement = formatTapeMeasurement(entry);
    return (
      <div key={entry.id} className={`calc-tape-row${entry.used ? " is-used" : ""}`}>
        <button
          type="button"
          className="calc-tape-check"
          aria-label={`Mark ${measurement} ${entry.used ? "unused" : "used"}`}
          aria-pressed={entry.used}
          onClick={() => toggleTapeMeasurement(entry.id)}
        >
          {entry.used ? <Check size={16} /> : null}
        </button>
        <button
          type="button"
          className="calc-tape-value"
          aria-label={`Load measurement ${measurement}`}
          onClick={() => reuseTapeMeasurement(entry, closeHistory)}
        >
          <span>Measurement {measurementNumber}</span>
          <strong>{measurement}</strong>
        </button>
      </div>
    );
  }

  const metricImperialPresentation = presentationFromExactUnits(displayValueUnits);
  const primaryValue = inputMode === "metric"
    ? formatMillimeters(displayValueUnits)
    : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier, displayApproximate);
  const secondaryLabel = inputMode === "metric" ? "Meters" : "Decimal";
  const secondaryValue = inputMode === "metric"
    ? formatMeters(displayValueUnits)
    : `${formatNumber(displayExactUnits / UNITS_PER_INCH, 4)} in`;
  const metaValues = inputMode === "metric"
    ? [
        formatMillimeters(displayValueUnits),
        formatCentimeters(displayValueUnits),
        formatMeters(displayValueUnits),
        formatImperialMeasurement(
          metricImperialPresentation.units,
          "inches",
          metricImperialPresentation.qualifier,
          metricImperialPresentation.approximate,
        ),
      ]
    : [
        `${formatNumber(displayExactUnits / UNITS_PER_INCH, 4)} in`,
        `${formatNumber(displayExactUnits / UNITS_PER_FOOT, 4)} ft`,
        formatMillimeters(displayExactUnits),
        pendingOperator ? `${pendingOperator} pending` : displayQualifier === "exact" ? activeUnit === "feet" ? "Entering feet" : "Entering inches" : `${displayQualifier === "heavy" ? "Heavy" : "Light"} tape mark`,
      ];
  const resultCardPrimary = inputMode === "metric"
    ? formatMillimeters(displayValueUnits)
    : formatImperialMeasurement(displayValueUnits, activeUnit, displayQualifier, displayApproximate);
  const resultCardSecondaryLabel = inputMode === "metric" ? "Imperial" : "Metric";
  const resultCardSecondaryValue = inputMode === "metric"
    ? formatImperialMeasurement(
        metricImperialPresentation.units,
        "inches",
        metricImperialPresentation.qualifier,
        metricImperialPresentation.approximate,
      )
    : formatMillimeters(displayExactUnits);
  const equationLabel = accumulatorUnits !== null && pendingOperator
    ? `${formatForMode(accumulatorUnits, inputMode, activeUnit, accumulatorQualifier, accumulatorApproximate)} ${formatOperator(pendingOperator)} ${formatForMode(entryValueUnits, inputMode, activeUnit, entryQualifier, entryApproximate)}`
    : historyLabel;
  const visibleTapeMeasurements = tapeMeasurements.slice(-5);

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
          <button type="button" className="calc-action-button" aria-label="Tape history" onClick={() => setHistoryOpen(true)}>
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
            <div className={`fraction-calc-left${inputMode === "imperial" && !fractionKeysVisible ? " fractions-hidden" : ""}`}>
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
                    <button type="button" className="active unit-metric" aria-label="Millimeters input" aria-pressed="true">
                      <span>MM</span>
                      <strong>{formatMetricEntry(metricText, metricTenths).replace(" mm", "")}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" aria-label="Centimeters readout" tabIndex={-1}>
                      <span>CM</span>
                      <strong>{formatNumber(displayValueUnits / (UNITS_PER_MM * 10), 2)}</strong>
                    </button>
                    <button type="button" className="unit-metric-readout" aria-label="Meters readout" tabIndex={-1}>
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
                    <button type="button" className={fraction32 ? "active unit-fraction" : "unit-fraction"} aria-label="Fraction input" onClick={() => { setFraction32(0); setEntryQualifier("exact"); setResultQualifier("exact"); setEntryApproximate(false); setResultApproximate(false); }}>
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
                  aria-label={inputMode === "metric" ? "Light minus half millimetre" : "Mark measurement light"}
                  aria-pressed={inputMode === "imperial" && displayQualifier === "light"}
                  onClick={() => applyHeavyLight("light")}
                >
                  <strong>L</strong>
                  <small>{inputMode === "metric" ? "-0.5 mm" : "Light"}</small>
                </button>
                <button
                  type="button"
                  aria-label={inputMode === "metric" ? "Heavy plus half millimetre" : "Mark measurement heavy"}
                  aria-pressed={inputMode === "imperial" && displayQualifier === "heavy"}
                  onClick={() => applyHeavyLight("heavy")}
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
              ) : fractionKeysVisible ? (
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
              ) : (
                <section className="calc-tape-queue" aria-label="Tape List">
                  <header>
                    <div>
                      <ListChecks size={17} />
                      <strong>Tape List</strong>
                    </div>
                    <span>{tapeMeasurements.filter((entry) => !entry.used).length} ready</span>
                  </header>
                  <div className="calc-tape-rows">
                    {visibleTapeMeasurements.length
                      ? visibleTapeMeasurements.map((entry) => renderTapeMeasurementRow(entry))
                      : (
                          <div className="calc-tape-empty">
                            <strong>No measurements yet</strong>
                            <span>Enter a measurement, then tap Add.</span>
                          </div>
                        )}
                  </div>
                </section>
              )}

              <div className="calc-pad-grid fraction-pad" aria-label={inputMode === "metric" ? "Metric calculator keypad" : "Fraction calculator keypad"}>
                {["7", "8", "9"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={inputMode === "metric" ? `Quick decimal for ${digit}` : fractionKeysVisible ? `Quick fractions for ${digit}` : "Tape fractions"} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} />)}
                <button type="button" className="op" onClick={() => applyOperator("/")}>/</button>
                {["4", "5", "6"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={inputMode === "metric" ? `Quick decimal for ${digit}` : fractionKeysVisible ? `Quick fractions for ${digit}` : "Tape fractions"} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} />)}
                <button type="button" className="op" onClick={() => applyOperator("x")}>x</button>
                {["1", "2", "3"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={inputMode === "metric" ? `Quick decimal for ${digit}` : fractionKeysVisible ? `Quick fractions for ${digit}` : "Tape fractions"} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} />)}
                <button type="button" className="op" onClick={() => applyOperator("-")}>-</button>
                <button type="button" className="wide" onClick={() => handleDigit("0")}>0</button>
                <button type="button" className="op ghost" onClick={handleBackspace} aria-label="Backspace">DEL</button>
                <button
                  type="button"
                  className="eq calc-enter-key"
                  aria-label={pendingOperator ? "Calculate result" : "Add measurement to Tape List"}
                  onClick={evaluate}
                >
                  <strong>=</strong>
                  <small>{pendingOperator ? "Solve" : "Add"}</small>
                </button>
                <button type="button" className="op plus" onClick={() => applyOperator("+")}>+</button>
              </div>
            </div>

            <aside className="fraction-result-card" aria-label="Result card">
              <Clipboard size={18} />
              <span>Result</span>
              <strong>{resultCardPrimary}</strong>
              <small>{inputMode === "metric" ? formatCentimeters(displayValueUnits) : `${formatNumber(displayExactUnits / UNITS_PER_INCH, 4)} in`}</small>
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
              onClick={() => { setFraction32(tick.value); setEntryQualifier("exact"); setResultQualifier("exact"); setEntryApproximate(false); setResultApproximate(false); }}
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
                  <strong>Fraction key visibility</strong>
                  <span>Hide the fraction strip to expand the Tape List. Hold any number key to reach every sixteenth.</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label="Fraction key visibility">
                  <button type="button" className={fractionKeysVisible ? "active" : ""} onClick={() => setFractionKeysVisible(true)}>Shown</button>
                  <button type="button" className={!fractionKeysVisible ? "active" : ""} onClick={() => setFractionKeysVisible(false)}>Hidden</button>
                </div>
              </section>
              <section>
                <div>
                  <strong>Tape precision</strong>
                  <span>Calculations resolve to 1/32 inch. Odd marks display as Heavy or Light against a 1/16 tape mark; finer results show ≈ after rounding.</span>
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
                <h2 id="calc-history-title">Tape history</h2>
              </div>
              <button type="button" className="v2-icon-button" aria-label="Close Tape history" onClick={() => setHistoryOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <section className="calc-history-section" aria-labelledby="calc-tape-list-title">
              <header>
                <div>
                  <h3 id="calc-tape-list-title">Tape List</h3>
                  <span>Saved on this device</span>
                </div>
                <strong>{tapeMeasurements.filter((entry) => !entry.used).length} ready</strong>
              </header>
              {tapeMeasurements.length ? (
                <div className="calc-tape-rows is-history">
                  {tapeMeasurements.map((entry) => renderTapeMeasurementRow(entry, true))}
                </div>
              ) : (
                <div className="calc-history-empty is-compact">
                  <ListChecks size={22} />
                  <strong>No measurements yet</strong>
                  <span>Enter a measurement and tap Add.</span>
                </div>
              )}
              {tapeMeasurements.some((entry) => entry.used) ? (
                <button
                  type="button"
                  className="calc-history-clear"
                  onClick={() => setTapeMeasurements((entries) => entries.filter((entry) => !entry.used))}
                >
                  <Trash2 size={17} />
                  Clear used measurements
                </button>
              ) : null}
            </section>
            <section className="calc-history-section" aria-labelledby="calc-equation-history-title">
              <header>
                <div>
                  <h3 id="calc-equation-history-title">Calculations</h3>
                  <span>Most recent equations</span>
                </div>
              </header>
            {calculationHistory.length ? (
              <div className="calc-history-list">
                {calculationHistory.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => reuseHistoryEntry(entry)}>
                    <span>{entry.expression}</span>
                    <strong>{formatForMode(entry.resultUnits, entry.inputMode, entry.activeUnit ?? "inches", entry.qualifier ?? "exact", entry.approximate ?? false)}</strong>
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
            </section>
          </DialogSurface>
        </DialogBackdrop>,
        document.body,
      ) : null}
    </section>
  );
}
