import { ArrowLeft, Check, Clipboard, Clock3, Copy, ListChecks, RotateCcw, Ruler, Settings2, Trash2, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DialogBackdrop, DialogSurface } from "../../components/ui";

type ActiveUnit = "feet" | "inches";
type InputMode = "imperial" | "metric";
type Operator = "+" | "-" | "x" | "/";
type TapeQualifier = "light" | "exact" | "heavy";
type ImperialNotation = "inches" | "feet-inches";
type FractionLayout = "tape" | "grouped";
type WheelHand = "auto" | "left" | "right";

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
  "3": [3, 6, 12],
  "4": [4, 8, 12],
  "5": [5, 10],
  "7": [7, 14],
  "8": [2, 6, 10, 14],
};
const IMPERIAL_DIGIT_FAMILY_LABELS: Record<string, string> = {
  "1": "Unit fractions",
  "3": "Fractions built from 3",
  "4": "Quarters",
  "5": "Fractions built from 5",
  "7": "Fractions built from 7",
  "8": "Eighths",
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
  label?: string;
  used: boolean;
};

type TapePresentation = {
  units: number;
  qualifier: TapeQualifier;
  approximate: boolean;
};

type CalculatorUndoSnapshot = {
  inputMode: InputMode;
  activeUnit: ActiveUnit;
  feetText: string;
  inchesText: string;
  fraction32: number;
  metricText: string;
  metricTenths: number;
  accumulatorUnits: number | null;
  accumulatorQualifier: TapeQualifier;
  accumulatorApproximate: boolean;
  pendingOperator: Operator | null;
  resultUnits: number | null;
  entryQualifier: TapeQualifier;
  resultQualifier: TapeQualifier;
  entryApproximate: boolean;
  resultApproximate: boolean;
  historyLabel: string;
  tapeMeasurements: TapeMeasurementEntry[];
  calculationHistory: CalculationHistoryEntry[];
};

type CalculatorPreferences = {
  inputMode: InputMode;
  imperialNotation: ImperialNotation;
  fractionLayout: FractionLayout;
  fractionKeysVisible: boolean;
  metricDecimalKeysVisible: boolean;
  wheelHand: WheelHand;
};

type QuickEntryOption = {
  label: string;
  ariaLabel: string;
  value: number;
};

const MULTIPLY_QUICK_OPTIONS: QuickEntryOption[] = [2, 3, 4, 6, 12].map((value) => ({
  label: `×${value}`,
  ariaLabel: `Multiply measurement by ${value}`,
  value,
}));

const DIVIDE_QUICK_OPTIONS: QuickEntryOption[] = [2, 3, 4, 6, 12].map((value) => ({
  label: `÷${value}`,
  ariaLabel: `Divide measurement by ${value}`,
  value: 1 / value,
}));

type QuickWheelPosition = {
  anchorX: number;
  anchorY: number;
  radius: number;
};

function QuickWheelButton({
  label,
  options,
  menuLabel,
  onTap,
  onQuickSelect,
  getPreviewLabel,
  wheelHand = "auto",
  className,
  children,
}: {
  label: string;
  options: QuickEntryOption[];
  menuLabel: string;
  onTap: () => void;
  onQuickSelect: (value: number) => void;
  getPreviewLabel?: (value: number) => string;
  wheelHand?: WheelHand;
  className?: string;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const openRef = useRef(false);
  const keyboardOpenRef = useRef(false);
  const selectedIndexRef = useRef<number | null>(null);
  const wheelPositionRef = useRef<QuickWheelPosition | null>(null);
  const suppressClickRef = useRef(false);
  const suppressResetTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [wheelPosition, setWheelPosition] = useState<QuickWheelPosition | null>(null);
  const [wheelFan, setWheelFan] = useState<Exclude<WheelHand, "auto">>("right");

  const optionAngle = useCallback((index: number) => {
    if (options.length === 1) return -90;
    const startAngle = wheelFan === "right" ? -175 : -155;
    return startAngle + (150 / (options.length - 1)) * index;
  }, [options.length, wheelFan]);

  const optionOffset = useCallback((index: number, radius: number) => {
    const angle = optionAngle(index) * (Math.PI / 180);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }, [optionAngle]);

  function openQuickWheel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const radius = options.length >= 5 ? 92 : options.length >= 4 ? 88 : 82;
    setWheelFan(wheelHand === "auto"
      ? rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right"
      : wheelHand);
    const outerPadding = radius + 44;
    const anchorX = Math.min(
      Math.max(rect.left + rect.width / 2, outerPadding),
      window.innerWidth - outerPadding,
    );
    const anchorY = Math.max(rect.top + rect.height / 2, radius + 50);
    const nextPosition = { anchorX, anchorY, radius };
    wheelPositionRef.current = nextPosition;
    setWheelPosition(nextPosition);
    openRef.current = true;
    setOpen(true);
    setSelectedIndex(null);
    selectedIndexRef.current = null;
  }

  function closeQuickWheel() {
    openRef.current = false;
    keyboardOpenRef.current = false;
    wheelPositionRef.current = null;
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    setOpen(false);
  }

  function cancelHold(closeWheel = false) {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    pointerOriginRef.current = null;
    if (closeWheel) closeQuickWheel();
  }

  const updateWheelSelection = useCallback((clientX: number, clientY: number) => {
    const position = wheelPositionRef.current;
    if (!position) return;
    let closestIndex: number | null = null;
    let closestDistance = 62;
    options.forEach((_, index) => {
      const offset = optionOffset(index, position.radius);
      const distance = Math.hypot(
        clientX - (position.anchorX + offset.x),
        clientY - (position.anchorY + offset.y),
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    if (closestIndex !== selectedIndexRef.current) {
      selectedIndexRef.current = closestIndex;
      setSelectedIndex(closestIndex);
      if (closestIndex !== null) navigator.vibrate?.(7);
    }
  }, [optionOffset, options]);

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
    if (keyboardOpenRef.current) {
      wheelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
      keyboardOpenRef.current = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeQuickWheel();
      buttonRef.current?.focus();
    }
    function closeOnViewportChange() {
      closeQuickWheel();
    }
    function trackPointer(event: PointerEvent) {
      updateWheelSelection(event.clientX, event.clientY);
    }
    function commitPointerSelection() {
      if (!openRef.current) return;
      const selected = selectedIndexRef.current;
      if (selected !== null) onQuickSelect(options[selected].value);
      window.setTimeout(() => {
        closeQuickWheel();
        buttonRef.current?.focus();
      }, 60);
    }
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("pointermove", trackPointer, true);
    window.addEventListener("pointerup", commitPointerSelection, true);
    window.addEventListener("pointercancel", closeOnViewportChange, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("pointermove", trackPointer, true);
      window.removeEventListener("pointerup", commitPointerSelection, true);
      window.removeEventListener("pointercancel", closeOnViewportChange, true);
    };
  }, [onQuickSelect, open, options, updateWheelSelection]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${className ?? ""}${options.length ? " has-quick-entry" : ""}`.trim() || undefined}
        aria-haspopup={options.length ? "menu" : undefined}
        aria-expanded={options.length ? open : undefined}
        aria-label={options.length ? `${label}. Hold and slide for quick choices.` : label}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!options.length || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerOriginRef.current = { x: event.clientX, y: event.clientY };
          holdTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            keyboardOpenRef.current = false;
            openQuickWheel();
            navigator.vibrate?.(12);
          }, QUICK_ENTRY_HOLD_MS);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (openRef.current) {
            updateWheelSelection(event.clientX, event.clientY);
            return;
          }
          const origin = pointerOriginRef.current;
          if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 10) return;
          cancelHold();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          const wasOpen = openRef.current;
          cancelHold();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (wasOpen) return;
          if (!suppressClickRef.current) return;
          suppressResetTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
            suppressResetTimerRef.current = null;
          }, 300);
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          cancelHold(true);
        }}
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
        onKeyDown={(event) => {
          if (!options.length || event.key !== "ArrowUp") return;
          event.preventDefault();
          suppressClickRef.current = false;
          keyboardOpenRef.current = true;
          openQuickWheel();
        }}
      >
        {children}
        {options.length ? <span className="calc-hold-cue" aria-hidden="true" /> : null}
      </button>
      {open && wheelPosition ? createPortal(
        <div className="calc-quick-entry-layer" role="presentation" onPointerDown={closeQuickWheel}>
          <div
            ref={wheelRef}
            className="calc-quick-wheel"
            role="menu"
            aria-label={menuLabel}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: wheelPosition.anchorX,
              top: wheelPosition.anchorY,
              "--calc-wheel-radius": `${wheelPosition.radius}px`,
            } as CSSProperties}
          >
            <div className="calc-quick-wheel-origin" aria-hidden="true">
              <span>Slide</span>
            </div>
            <span className="calc-quick-wheel-title">
              {selectedIndex !== null && getPreviewLabel ? getPreviewLabel(options[selectedIndex].value) : menuLabel}
            </span>
            <span className="calc-quick-wheel-context">
              {selectedIndex !== null ? menuLabel : "Move to a choice"}
            </span>
            <div className="calc-quick-wheel-options">
              {options.map((option) => (
                <button
                  key={`${label}-${option.label}`}
                  type="button"
                  role="menuitem"
                  className={selectedIndex === options.indexOf(option) ? "is-selected" : ""}
                  aria-label={option.ariaLabel}
                  style={{
                    "--calc-wheel-angle": `${optionAngle(options.indexOf(option))}deg`,
                    "--calc-wheel-x": `${optionOffset(options.indexOf(option), wheelPosition.radius).x}px`,
                    "--calc-wheel-y": `${optionOffset(options.indexOf(option), wheelPosition.radius).y}px`,
                  } as CSSProperties}
                  onPointerEnter={() => {
                    selectedIndexRef.current = options.indexOf(option);
                    setSelectedIndex(options.indexOf(option));
                  }}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      clearClickSuppression();
                      closeQuickWheel();
                      buttonRef.current?.focus();
                      return;
                    }
                    clearClickSuppression();
                    onQuickSelect(option.value);
                    closeQuickWheel();
                    buttonRef.current?.focus();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <small className="calc-quick-wheel-hint">{selectedIndex !== null ? "Lift to use" : "Release to cancel"}</small>
          </div>
        </div>,
        document.querySelector(".rivt-v2") ?? document.body,
      ) : null}
    </>
  );
}

function QuickEntryDigitKey(props: {
  digit: string;
  options: QuickEntryOption[];
  menuLabel: string;
  onTap: () => void;
  onQuickEntry: (value: number) => void;
  getPreviewLabel?: (value: number) => string;
  wheelHand?: WheelHand;
}) {
  return (
    <QuickWheelButton
      label={props.digit}
      options={props.options}
      menuLabel={props.menuLabel}
      onTap={props.onTap}
      onQuickSelect={props.onQuickEntry}
      getPreviewLabel={props.getPreviewLabel}
      wheelHand={props.wheelHand}
    >
      {props.digit}
    </QuickWheelButton>
  );
}

function HoldClearButton({ onDelete, onClear }: { onDelete: () => void; onClear: () => void }) {
  const holdTimerRef = useRef<number | null>(null);
  const didClearRef = useRef(false);

  function cancelTimer() {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  useEffect(() => cancelTimer, []);

  return (
    <button
      type="button"
      className="op ghost calc-delete-key has-quick-entry"
      aria-label="Delete last digit. Hold to clear current problem."
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button !== 0) return;
        didClearRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        holdTimerRef.current = window.setTimeout(() => {
          didClearRef.current = true;
          onClear();
          navigator.vibrate?.([12, 30, 12]);
        }, QUICK_ENTRY_HOLD_MS + 120);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        cancelTimer();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        cancelTimer();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (didClearRef.current) {
          didClearRef.current = false;
          return;
        }
        onDelete();
      }}
    >
      DEL
      <span className="calc-hold-cue" aria-hidden="true" />
    </button>
  );
}

const DEFAULT_CALCULATOR_PREFERENCES: CalculatorPreferences = {
  inputMode: "imperial",
  imperialNotation: "inches",
  fractionLayout: "tape",
  fractionKeysVisible: true,
  metricDecimalKeysVisible: true,
  wheelHand: "auto",
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
      metricDecimalKeysVisible: parsed?.metricDecimalKeysVisible !== false,
      wheelHand: parsed?.wheelHand === "left" || parsed?.wheelHand === "right" ? parsed.wheelHand : "auto",
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
          && (candidate.label === undefined || typeof candidate.label === "string")
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
  const [metricDecimalKeysVisible, setMetricDecimalKeysVisible] = useState(initialPreferences.metricDecimalKeysVisible);
  const [wheelHand, setWheelHand] = useState<WheelHand>(initialPreferences.wheelHand);
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
  const [markPickerOpen, setMarkPickerOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<CalculatorUndoSnapshot | null>(null);
  const [editingTapeLabelId, setEditingTapeLabelId] = useState<string | null>(null);
  const [tapeLabelDraft, setTapeLabelDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const markPickerButtonRef = useRef<HTMLButtonElement>(null);
  const clearUndoTimerRef = useRef<number | null>(null);

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
  const shortcutKeysVisible = inputMode === "metric" ? metricDecimalKeysVisible : fractionKeysVisible;

  useEffect(() => {
    try {
      localStorage.setItem(CALCULATOR_PREFS_KEY, JSON.stringify({
        inputMode,
        imperialNotation,
        fractionLayout,
        fractionKeysVisible,
        metricDecimalKeysVisible,
        wheelHand,
      } satisfies CalculatorPreferences));
    } catch { /* harmless preference */ }
  }, [fractionKeysVisible, fractionLayout, imperialNotation, inputMode, metricDecimalKeysVisible, wheelHand]);

  useEffect(() => {
    try { localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(calculationHistory)); } catch { /* harmless device history */ }
  }, [calculationHistory]);

  useEffect(() => {
    try { localStorage.setItem(CALCULATOR_TAPE_LIST_KEY, JSON.stringify(tapeMeasurements)); } catch { /* harmless device tape list */ }
  }, [tapeMeasurements]);

  function dismissClearUndo() {
    if (clearUndoTimerRef.current !== null) window.clearTimeout(clearUndoTimerRef.current);
    clearUndoTimerRef.current = null;
    setUndoSnapshot(null);
  }

  function rememberClearUndo() {
    if (clearUndoTimerRef.current !== null) window.clearTimeout(clearUndoTimerRef.current);
    setUndoSnapshot({
      inputMode,
      activeUnit,
      feetText,
      inchesText,
      fraction32,
      metricText,
      metricTenths,
      accumulatorUnits,
      accumulatorQualifier,
      accumulatorApproximate,
      pendingOperator,
      resultUnits,
      entryQualifier,
      resultQualifier,
      entryApproximate,
      resultApproximate,
      historyLabel,
      tapeMeasurements,
      calculationHistory,
    });
    clearUndoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      clearUndoTimerRef.current = null;
    }, 5_000);
  }

  function undoLastChange() {
    if (!undoSnapshot) return;
    if (clearUndoTimerRef.current !== null) window.clearTimeout(clearUndoTimerRef.current);
    clearUndoTimerRef.current = null;
    setInputMode(undoSnapshot.inputMode);
    setActiveUnit(undoSnapshot.activeUnit);
    setFeetText(undoSnapshot.feetText);
    setInchesText(undoSnapshot.inchesText);
    setFraction32(undoSnapshot.fraction32);
    setMetricText(undoSnapshot.metricText);
    setMetricTenths(undoSnapshot.metricTenths);
    setAccumulatorUnits(undoSnapshot.accumulatorUnits);
    setAccumulatorQualifier(undoSnapshot.accumulatorQualifier);
    setAccumulatorApproximate(undoSnapshot.accumulatorApproximate);
    setPendingOperator(undoSnapshot.pendingOperator);
    setResultUnits(undoSnapshot.resultUnits);
    setEntryQualifier(undoSnapshot.entryQualifier);
    setResultQualifier(undoSnapshot.resultQualifier);
    setEntryApproximate(undoSnapshot.entryApproximate);
    setResultApproximate(undoSnapshot.resultApproximate);
    setHistoryLabel(undoSnapshot.historyLabel);
    setTapeMeasurements(undoSnapshot.tapeMeasurements);
    setCalculationHistory(undoSnapshot.calculationHistory);
    setCopied(false);
    setUndoSnapshot(null);
  }

  useEffect(() => () => {
    if (clearUndoTimerRef.current !== null) window.clearTimeout(clearUndoTimerRef.current);
  }, []);

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
    setMarkPickerOpen(false);
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
    dismissClearUndo();
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
    dismissClearUndo();
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
    rememberClearUndo();
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
    dismissClearUndo();
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
    dismissClearUndo();
    const base = resultUnits ?? entryValueUnits;
    const qualifier = displayQualifier;
    const scaleLabel = multiplier >= 1
      ? `× ${formatNumber(multiplier, 3)}`
      : `÷ ${formatNumber(1 / multiplier, 3)}`;
    const expression = `${formatForMode(base, inputMode, activeUnit, qualifier, displayApproximate)} ${scaleLabel}`;
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
    dismissClearUndo();
    setFraction32(sixteenth * 2);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
    setCopied(false);
  }

  function chooseMetricTenth(tenth: number) {
    dismissClearUndo();
    setMetricTenths(tenth);
    setResultUnits(null);
    setEntryQualifier("exact");
    setResultQualifier("exact");
    setEntryApproximate(false);
    setResultApproximate(false);
    setCopied(false);
  }

  function quickEntryOptions(digit: string): QuickEntryOption[] {
    if (inputMode === "metric") return [];

    const values = IMPERIAL_DIGIT_FRACTIONS[digit] ?? [];
    return values.map((value) => {
      const label = fractionLabelFromSixteenth(value);
      return { label, ariaLabel: `Enter ${label}`, value };
    });
  }

  function quickEntryMenuLabel(digit: string) {
    if (inputMode === "metric") return `Quick decimal for ${digit}`;
    return IMPERIAL_DIGIT_FAMILY_LABELS[digit] ?? `Quick fractions for ${digit}`;
  }

  function quickEntryPreview(value: number) {
    if (inputMode === "metric") return formatMetricEntry(metricText, value);
    return formatImperialMeasurement(
      valueFromImperialEntry(feetText, inchesText, value * 2),
      activeUnit,
      "exact",
      false,
    );
  }

  function scalePreview(multiplier: number) {
    const base = resultUnits ?? entryValueUnits;
    if (inputMode === "metric") return formatMillimeters(Math.max(0, Math.round(base * multiplier)));
    const presentation = presentationFromExactUnits(exactTapeUnits(base, displayQualifier) * multiplier);
    return formatImperialMeasurement(
      presentation.units,
      activeUnit,
      presentation.qualifier,
      displayApproximate || presentation.approximate,
    );
  }

  function applyOperator(operator: Operator) {
    dismissClearUndo();
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
    dismissClearUndo();
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

  function startTapeLabel(entry: TapeMeasurementEntry) {
    setEditingTapeLabelId(entry.id);
    setTapeLabelDraft(entry.label ?? "");
  }

  function saveTapeLabel(entryId: string) {
    const label = tapeLabelDraft.trim().slice(0, 32);
    setTapeMeasurements((entries) => entries.map((entry) => (
      entry.id === entryId ? { ...entry, label: label || undefined } : entry
    )));
    setEditingTapeLabelId(null);
    setTapeLabelDraft("");
  }

  function cancelTapeLabel() {
    setEditingTapeLabelId(null);
    setTapeLabelDraft("");
  }

  function renderTapeMeasurementRow(entry: TapeMeasurementEntry, closeHistory = false) {
    const measurementNumber = tapeMeasurements.findIndex((candidate) => candidate.id === entry.id) + 1;
    const measurement = formatTapeMeasurement(entry);
    return (
      <div key={entry.id} className="calc-tape-entry">
        <div className={`calc-tape-row${entry.used ? " is-used" : ""}`}>
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
            aria-label={`Load ${entry.label ? `${entry.label}, ` : ""}measurement ${measurement}`}
            onClick={() => reuseTapeMeasurement(entry, closeHistory)}
          >
            <span>{entry.label || `Measurement ${measurementNumber}`}</span>
            <strong>{measurement}</strong>
          </button>
        </div>
        {closeHistory ? (
          editingTapeLabelId === entry.id ? (
            <div className="calc-tape-label-editor">
              <input
                type="text"
                value={tapeLabelDraft}
                maxLength={32}
                aria-label={`Label for measurement ${measurement}`}
                placeholder="Door RO, left stile, top cut…"
                autoFocus
                onChange={(event) => setTapeLabelDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveTapeLabel(entry.id);
                  if (event.key === "Escape") cancelTapeLabel();
                }}
              />
              <button type="button" onClick={() => saveTapeLabel(entry.id)}>Save</button>
              <button type="button" onClick={cancelTapeLabel}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="calc-tape-label-action" onClick={() => startTapeLabel(entry)}>
              {entry.label ? `Edit label · ${entry.label}` : "Add a short label"}
            </button>
          )
        ) : null}
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
            <div className={`fraction-calc-left${!shortcutKeysVisible ? " fractions-hidden" : ""}`}>
              <section className={`calc-measurement-workspace${!shortcutKeysVisible ? " has-tape-list" : ""}`}>
                <div className="calc-display-stack fraction-display">
                  <span className="fraction-history">{equationLabel}</span>
                  <strong className="calc-primary-value">{primaryValue}</strong>
                  <div className="calc-secondary-row">
                    <span>{secondaryLabel}</span>
                    {undoSnapshot ? (
                      <button type="button" className="calc-display-undo" aria-label="Undo calculator clear" onClick={undoLastChange}>
                        <RotateCcw size={14} />
                        Cleared <span aria-hidden="true">·</span> Undo
                      </button>
                    ) : null}
                    <strong>{secondaryValue}</strong>
                  </div>
                  <div className="fraction-display-meta">
                    {metaValues.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
                  </div>
                </div>
                {!shortcutKeysVisible ? (
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
                              <span>Enter a measurement, then tap =.</span>
                            </div>
                          )}
                    </div>
                  </section>
                ) : null}
              </section>

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

              {inputMode === "metric" && shortcutKeysVisible ? (
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
              ) : inputMode === "imperial" && shortcutKeysVisible ? (
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
              ) : null}

              <div className="fraction-action-row" aria-label="Measurement shortcuts">
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
                <button
                  ref={markPickerButtonRef}
                  type="button"
                  className="calc-all-marks-control"
                  aria-haspopup="dialog"
                  aria-expanded={markPickerOpen}
                  aria-label={inputMode === "metric" ? "Open all metric decimals" : "Open all tape fractions"}
                  onClick={() => setMarkPickerOpen(true)}
                >
                  <strong>{inputMode === "metric" ? ".1–.9" : "ALL"}</strong>
                  <small>{inputMode === "metric" ? "Decimals" : "Fractions"}</small>
                </button>
                <QuickWheelButton
                  label="Divide measurement by two"
                  options={DIVIDE_QUICK_OPTIONS}
                  menuLabel="Quick divide"
                  onTap={() => scaleEntry(0.5)}
                  onQuickSelect={scaleEntry}
                  getPreviewLabel={scalePreview}
                  wheelHand={wheelHand}
                >
                  <strong>&divide;2</strong>
                  <small>Hold for more</small>
                </QuickWheelButton>
                <QuickWheelButton
                  label="Multiply measurement by two"
                  options={MULTIPLY_QUICK_OPTIONS}
                  menuLabel="Quick multiply"
                  onTap={() => scaleEntry(2)}
                  onQuickSelect={scaleEntry}
                  getPreviewLabel={scalePreview}
                  wheelHand={wheelHand}
                >
                  <strong>&times;2</strong>
                  <small>Hold for more</small>
                </QuickWheelButton>
              </div>

              <div className="calc-pad-grid fraction-pad" aria-label={inputMode === "metric" ? "Metric calculator keypad" : "Fraction calculator keypad"}>
                {["7", "8", "9"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={quickEntryMenuLabel(digit)} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} getPreviewLabel={quickEntryPreview} wheelHand={wheelHand} />)}
                <QuickWheelButton
                  label="Divide"
                  className="op"
                  options={DIVIDE_QUICK_OPTIONS}
                  menuLabel="Quick divide"
                  onTap={() => applyOperator("/")}
                  onQuickSelect={scaleEntry}
                  getPreviewLabel={scalePreview}
                  wheelHand={wheelHand}
                >
                  /
                </QuickWheelButton>
                {["4", "5", "6"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={quickEntryMenuLabel(digit)} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} getPreviewLabel={quickEntryPreview} wheelHand={wheelHand} />)}
                <QuickWheelButton
                  label="Multiply"
                  className="op"
                  options={MULTIPLY_QUICK_OPTIONS}
                  menuLabel="Quick multiply"
                  onTap={() => applyOperator("x")}
                  onQuickSelect={scaleEntry}
                  getPreviewLabel={scalePreview}
                  wheelHand={wheelHand}
                >
                  x
                </QuickWheelButton>
                {["1", "2", "3"].map((digit) => <QuickEntryDigitKey key={digit} digit={digit} options={quickEntryOptions(digit)} menuLabel={quickEntryMenuLabel(digit)} onTap={() => handleDigit(digit)} onQuickEntry={inputMode === "metric" ? chooseMetricTenth : chooseFraction} getPreviewLabel={quickEntryPreview} wheelHand={wheelHand} />)}
                <button type="button" className="op" onClick={() => applyOperator("-")}>-</button>
                <button type="button" className="wide" onClick={() => handleDigit("0")}>0</button>
                <HoldClearButton onDelete={handleBackspace} onClear={clearAll} />
                <button
                  type="button"
                  className="eq calc-enter-key"
                  aria-label={pendingOperator ? "Calculate result" : "Add measurement to Tape List"}
                  onClick={evaluate}
                >
                  <strong>=</strong>
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
      {markPickerOpen ? createPortal(
        <DialogBackdrop
          className="calc-history-backdrop calc-mark-picker-backdrop"
          onClose={() => {
            setMarkPickerOpen(false);
            markPickerButtonRef.current?.focus();
          }}
        >
          <DialogSurface
            className={`calc-history-sheet calc-mark-picker-sheet${inputMode === "metric" ? " is-metric" : ""}`}
            labelledBy="calc-mark-picker-title"
            onClose={() => {
              setMarkPickerOpen(false);
              markPickerButtonRef.current?.focus();
            }}
          >
            <header>
              <div>
                <span>{inputMode === "metric" ? "Metric entry" : "Tape marks"}</span>
                <h2 id="calc-mark-picker-title">{inputMode === "metric" ? "Choose a decimal" : "Choose a fraction"}</h2>
              </div>
              <button
                type="button"
                className="v2-icon-button"
                aria-label="Close mark picker"
                onClick={() => {
                  setMarkPickerOpen(false);
                  markPickerButtonRef.current?.focus();
                }}
              >
                <X size={20} />
              </button>
            </header>
            <p className="calc-mark-picker-help">
              {inputMode === "metric"
                ? "Add a tenth of a millimeter to the current whole-millimeter entry."
                : "All marks are shown in the same order as a sixteenth-inch tape."}
            </p>
            <div
              className="calc-mark-picker-grid"
              role="group"
              aria-label={inputMode === "metric" ? "All metric decimals" : "All tape fractions"}
            >
              {(inputMode === "metric" ? METRIC_TENTH_BUTTONS : FRACTION_BUTTONS).map((value) => {
                const label = inputMode === "metric" ? `.${value}` : fractionLabelFromSixteenth(value);
                const active = inputMode === "metric" ? metricTenths === value : fraction32 === value * 2;
                return (
                  <button
                    key={`${inputMode}-${value}`}
                    type="button"
                    className={active ? "active" : ""}
                    aria-pressed={active}
                    aria-label={inputMode === "metric" ? `Enter point ${value} millimeters` : `Enter ${label}`}
                    onClick={() => {
                      if (inputMode === "metric") chooseMetricTenth(value);
                      else chooseFraction(value);
                      setMarkPickerOpen(false);
                      markPickerButtonRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </DialogSurface>
        </DialogBackdrop>,
        document.querySelector(".rivt-v2") ?? document.body,
      ) : null}
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
                  <strong>Quick-wheel reach</strong>
                  <span>Auto opens away from the nearest screen edge. Choose a hand to keep every wheel biased the same way.</span>
                </div>
                <div className="calc-settings-options has-three" role="group" aria-label="Quick-wheel reach">
                  <button type="button" className={wheelHand === "auto" ? "active" : ""} onClick={() => setWheelHand("auto")}>Auto</button>
                  <button type="button" className={wheelHand === "left" ? "active" : ""} onClick={() => setWheelHand("left")}>Left hand</button>
                  <button type="button" className={wheelHand === "right" ? "active" : ""} onClick={() => setWheelHand("right")}>Right hand</button>
                </div>
              </section>
              {inputMode === "imperial" ? (
                <>
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
                      <strong>Fraction key layout</strong>
                      <span>Keep tape order or bring larger tape marks forward.</span>
                    </div>
                    <div className="calc-settings-options" role="group" aria-label="Fraction key layout">
                      <button type="button" className={fractionLayout === "tape" ? "active" : ""} onClick={() => setFractionLayout("tape")}>Tape order</button>
                      <button type="button" className={fractionLayout === "grouped" ? "active" : ""} onClick={() => setFractionLayout("grouped")}>Grouped marks</button>
                    </div>
                  </section>
                </>
              ) : (
                <section>
                  <div>
                    <strong>Metric entry</strong>
                    <span>Whole-number keys enter millimeters. Decimal shortcuts add tenths from .1 through .9.</span>
                  </div>
                </section>
              )}
              <section>
                <div>
                  <strong>{inputMode === "metric" ? "Decimal shortcut visibility" : "Fraction key visibility"}</strong>
                  <span>{inputMode === "metric"
                    ? "Hide the decimal strip to expand the Tape List. The center Decimals button still opens all tenths."
                    : "Hide the fraction strip to expand the Tape List. The center All marks button still opens every sixteenth."}</span>
                </div>
                <div className="calc-settings-options" role="group" aria-label={inputMode === "metric" ? "Decimal shortcut visibility" : "Fraction key visibility"}>
                  <button
                    type="button"
                    className={shortcutKeysVisible ? "active" : ""}
                    onClick={() => inputMode === "metric" ? setMetricDecimalKeysVisible(true) : setFractionKeysVisible(true)}
                  >
                    Shown
                  </button>
                  <button
                    type="button"
                    className={!shortcutKeysVisible ? "active" : ""}
                    onClick={() => inputMode === "metric" ? setMetricDecimalKeysVisible(false) : setFractionKeysVisible(false)}
                  >
                    Hidden
                  </button>
                </div>
              </section>
              <section>
                <div>
                  <strong>{inputMode === "metric" ? "Metric precision" : "Tape precision"}</strong>
                  <span>{inputMode === "metric"
                    ? "Entries resolve to 0.1 mm. Light and Heavy trim the current measurement by 0.5 mm."
                    : "Calculations resolve to 1/32 inch. Odd marks display as Heavy or Light against a 1/16 tape mark; finer results show ≈ after rounding."}</span>
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
                  <span>Enter a measurement and tap =.</span>
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
