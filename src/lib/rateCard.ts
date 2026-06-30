export const RATE_CARD_STORAGE_KEY = "rivt.rateCard.v1";

export interface RateCardEntry {
  id: string;
  trade: string;
  hourlyRate: number;
  dayRate: number;
  minimumCharge: number;
  notes: string;
  updatedAt: string;
}

function finiteMoney(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function entryId(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function entryText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 240) : fallback;
}

export function normalizeRateCardEntries(value: unknown, fallbackHourlyRate = 75): RateCardEntry[] {
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item, index) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const hourlyRate = finiteMoney(record.hourlyRate);
        if (!hourlyRate) return null;
        return {
          id: entryId(record.id, `rate_${index}`),
          trade: entryText(record.trade, index === 0 ? "Standard" : "Trade"),
          hourlyRate,
          dayRate: finiteMoney(record.dayRate),
          minimumCharge: finiteMoney(record.minimumCharge),
          notes: entryText(record.notes),
          updatedAt: entryText(record.updatedAt, new Date(0).toISOString()),
        };
      })
      .filter((entry): entry is RateCardEntry => Boolean(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const hourlyRate = finiteMoney(record.hourlyRate, fallbackHourlyRate);
    if (!hourlyRate) return [];
    return [{
      id: entryId(record.id, "standard"),
      trade: entryText(record.primaryTrade ?? record.trade, "Standard"),
      hourlyRate,
      dayRate: finiteMoney(record.dayRate),
      minimumCharge: finiteMoney(record.minimumCharge),
      notes: entryText(record.notes),
      updatedAt: entryText(record.updatedAt, new Date(0).toISOString()),
    }];
  }

  return [];
}

export function readRateCardEntries(fallbackHourlyRate = 75): RateCardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(RATE_CARD_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    const entries = normalizeRateCardEntries(parsed, fallbackHourlyRate);
    if (!Array.isArray(parsed) && entries.length) {
      persistRateCardEntries(entries);
    }
    return entries;
  } catch {
    return [];
  }
}

export function persistRateCardEntries(entries: RateCardEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATE_CARD_STORAGE_KEY, JSON.stringify(entries.slice(0, 12)));
  } catch {
    // Local storage is optional; tools fall back to defaults when unavailable.
  }
}

export function readPrimaryHourlyRate(fallbackHourlyRate = 75): number {
  const [first] = readRateCardEntries(fallbackHourlyRate);
  return first?.hourlyRate || fallbackHourlyRate;
}

export function readPrimaryTradeFromRateCard(): string {
  const [first] = readRateCardEntries();
  return first?.trade === "Standard" ? "" : first?.trade ?? "";
}
