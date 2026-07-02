import type { Trade } from "../../types";

export type PriceSignalTone = "low" | "fair" | "high" | "unknown";

interface PriceGuide {
  label: string;
  trades: Array<Trade | "General">;
  keywords: string[];
  unitLabel: string;
  low: number;
  high: number;
  compare: "rate" | "total";
  note: string;
}

export interface PriceSignal {
  label: string;
  tone: PriceSignalTone;
  verdict: string;
  rangeLabel: string;
  basisLabel: string;
  note: string;
}

const PRICE_GUIDES: PriceGuide[] = [
  {
    label: "General skilled labor",
    trades: ["General"],
    keywords: ["labor", "helper", "crew", "hour", "service"],
    unitLabel: "per hour",
    low: 45,
    high: 95,
    compare: "rate",
    note: "Good for side work labor checks. Specialty trades usually price higher.",
  },
  {
    label: "Punch-out work",
    trades: ["Carpentry", "General Labor", "Painting/Finishing", "Drywall"],
    keywords: ["punch", "trim", "touch up", "repair", "finish"],
    unitLabel: "per hour",
    low: 55,
    high: 105,
    compare: "rate",
    note: "Small scope work often needs a minimum charge even when the hours look light.",
  },
  {
    label: "Finish carpentry",
    trades: ["Carpentry", "Cabinetry"],
    keywords: ["cabinet", "built", "built-in", "scribe", "trim", "crown", "base", "door"],
    unitLabel: "per hour",
    low: 65,
    high: 125,
    compare: "rate",
    note: "Custom detail, layout risk, and callback exposure can push this above a standard labor rate.",
  },
  {
    label: "Tile install",
    trades: ["Tile"],
    keywords: ["tile", "backsplash", "shower", "thinset", "grout", "lippage"],
    unitLabel: "per sq ft / equivalent",
    low: 8,
    high: 28,
    compare: "rate",
    note: "Prep, waterproofing, pattern, and material size matter more than raw square footage.",
  },
  {
    label: "Electrical service",
    trades: ["Electrical", "Low Voltage", "Security Systems", "Solar"],
    keywords: ["electrical", "panel", "breaker", "rough", "fixture", "outlet", "switch"],
    unitLabel: "per hour",
    low: 85,
    high: 165,
    compare: "rate",
    note: "License, inspection exposure, and energized work should stay priced into the job.",
  },
  {
    label: "Plumbing service",
    trades: ["Plumbing", "Pool/Spa", "Fire Suppression"],
    keywords: ["plumb", "pex", "drain", "toilet", "sink", "water", "rough"],
    unitLabel: "per hour",
    low: 85,
    high: 160,
    compare: "rate",
    note: "Access, callbacks, shutoff risk, and fixture responsibility change the final number.",
  },
  {
    label: "HVAC service",
    trades: ["HVAC"],
    keywords: ["hvac", "mini split", "duct", "condenser", "air handler", "line set"],
    unitLabel: "per hour",
    low: 80,
    high: 155,
    compare: "rate",
    note: "Equipment responsibility and startup/checklist work should be included.",
  },
  {
    label: "Roofing or exterior crew",
    trades: ["Roofing", "Siding", "Gutters", "Windows/Doors"],
    keywords: ["roof", "siding", "gutter", "window", "door", "flashing"],
    unitLabel: "per crew day",
    low: 650,
    high: 1800,
    compare: "total",
    note: "Crew size, tear-off, access, weather, and dump fees can swing this fast.",
  },
  {
    label: "Concrete / masonry",
    trades: ["Concrete/Masonry", "Driveways/Pavers"],
    keywords: ["concrete", "masonry", "block", "paver", "driveway", "slab", "footing"],
    unitLabel: "scope check",
    low: 800,
    high: 4500,
    compare: "total",
    note: "Forms, base prep, pump/access, reinforcement, and finish spec drive the real range.",
  },
];

function currency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s/-]/g, " ");
}

function findGuide(description: string, trade?: Trade | null) {
  const normalized = normalize(description);
  const tradeMatches = PRICE_GUIDES.filter((guide) => !trade || guide.trades.includes(trade) || guide.trades.includes("General"));
  return (
    tradeMatches.find((guide) => guide.keywords.some((keyword) => normalized.includes(keyword))) ??
    PRICE_GUIDES.find((guide) => trade && guide.trades.includes(trade)) ??
    PRICE_GUIDES[0]
  );
}

function isMaterialOnlyLine(description: string) {
  const normalized = normalize(description);
  return [
    "material",
    "materials",
    "supply",
    "supplies",
    "parts",
    "fixture",
    "fixtures",
    "permit fee",
    "dump fee",
  ].some((keyword) => normalized.includes(keyword));
}

function toneFor(value: number, low: number, high: number): PriceSignalTone {
  if (!Number.isFinite(value) || value <= 0) return "unknown";
  if (value < low * 0.9) return "low";
  if (value > high * 1.12) return "high";
  return "fair";
}

function verdictFor(tone: PriceSignalTone) {
  if (tone === "low") return "Looks low";
  if (tone === "high") return "Looks high";
  if (tone === "fair") return "In range";
  return "Add price";
}

export function getInvoiceLinePriceSignal({
  description,
  qty,
  rate,
  trade,
}: {
  description: string;
  qty: number;
  rate: number;
  trade?: Trade | null;
}): PriceSignal | null {
  const cleanDescription = description.trim();
  if (!cleanDescription || isMaterialOnlyLine(cleanDescription)) return null;

  const guide = findGuide(cleanDescription, trade);
  const lineTotal = Math.max(0, qty) * Math.max(0, rate);
  const value = guide.compare === "rate" ? Math.max(0, rate) : lineTotal;
  const tone = toneFor(value, guide.low, guide.high);
  const basis = guide.compare === "rate" ? `${currency(value)} ${guide.unitLabel}` : `${currency(value)} line total`;

  return {
    label: guide.label,
    tone,
    verdict: verdictFor(tone),
    rangeLabel: `${currency(guide.low)} - ${currency(guide.high)} ${guide.unitLabel}`,
    basisLabel: basis,
    note: guide.note,
  };
}

export function getEstimatePriceSignal({
  title,
  trade,
  target,
  hourlyRate,
  laborHours,
}: {
  title?: string;
  trade?: Trade | null;
  target: number;
  hourlyRate: number;
  laborHours: number;
}): PriceSignal {
  const guide = findGuide(title || String(trade ?? "labor"), trade);
  const hourlyTone = toneFor(hourlyRate, guide.compare === "rate" ? guide.low : 45, guide.compare === "rate" ? guide.high : 95);
  const laborAdjustedLow = guide.compare === "rate" ? Math.max(guide.low * Math.max(1, laborHours), target * 0.7) : guide.low;
  const laborAdjustedHigh = guide.compare === "rate" ? Math.max(guide.high * Math.max(1, laborHours), target * 1.05) : guide.high;
  const totalTone = toneFor(target, laborAdjustedLow, laborAdjustedHigh);
  const tone = totalTone === "fair" ? hourlyTone : totalTone;

  return {
    label: guide.label,
    tone,
    verdict: verdictFor(tone),
    rangeLabel: `${currency(laborAdjustedLow)} - ${currency(laborAdjustedHigh)} similar scope`,
    basisLabel: `${currency(hourlyRate)} / hr · ${Math.max(0, laborHours).toFixed(1).replace(/\.0$/, "")} hrs`,
    note: `${guide.note} Pilot guidance only; confirm against your cost, risk, and local demand.`,
  };
}
