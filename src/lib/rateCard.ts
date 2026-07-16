import { apiPath, fetchWithTimeout } from "./api";

export const RATE_CARD_STORAGE_KEY = "rivt.rateCard.v1";

export type RateCardVisibility = "network" | "applications" | "private";

export interface RateCardEntry {
  id: string;
  trade: string;
  tradeCode: string;
  hourlyRate: number;
  dayRate: number;
  minimumCharge: number;
  notes: string;
  visibility: RateCardVisibility;
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

function visibilityValue(value: unknown): RateCardVisibility {
  return value === "network" || value === "private" ? value : "applications";
}

export function normalizeRateCardEntries(value: unknown, fallbackHourlyRate = 75): RateCardEntry[] {
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item, index) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const hourlyRate = finiteMoney(record.hourlyRate);
        const dayRate = finiteMoney(record.dayRate);
        const minimumCharge = finiteMoney(record.minimumCharge);
        if (!hourlyRate && !dayRate && !minimumCharge) return null;
        return {
          id: entryId(record.id, `rate_${index}`),
          trade: entryText(record.trade, index === 0 ? "Standard" : "Trade"),
          tradeCode: entryText(record.tradeCode, entryText(record.trade, "other").toLowerCase().replace(/[^a-z0-9]+/g, "_")),
          hourlyRate,
          dayRate,
          minimumCharge,
          notes: entryText(record.notes),
          visibility: visibilityValue(record.visibility),
          updatedAt: entryText(record.updatedAt, new Date(0).toISOString()),
        };
      })
      .filter((entry): entry is RateCardEntry => Boolean(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const hourlyRate = finiteMoney(record.hourlyRate, fallbackHourlyRate);
    const dayRate = finiteMoney(record.dayRate);
    const minimumCharge = finiteMoney(record.minimumCharge);
    if (!hourlyRate && !dayRate && !minimumCharge) return [];
    return [{
      id: entryId(record.id, "standard"),
      trade: entryText(record.primaryTrade ?? record.trade, "Standard"),
      tradeCode: entryText(record.tradeCode, entryText(record.primaryTrade ?? record.trade, "other").toLowerCase().replace(/[^a-z0-9]+/g, "_")),
      hourlyRate,
      dayRate,
      minimumCharge,
      notes: entryText(record.notes),
      visibility: visibilityValue(record.visibility),
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

interface ServerRateCardEntry {
  tradeCode: string;
  tradeName: string;
  hourlyRateCents: number | null;
  dayRateCents: number | null;
  minimumChargeCents: number | null;
  visibility: RateCardVisibility;
  notes: string;
  updatedAt?: string;
}

function fromServer(entry: ServerRateCardEntry): RateCardEntry {
  return {
    id: entry.tradeCode,
    trade: entry.tradeName,
    tradeCode: entry.tradeCode,
    hourlyRate: (entry.hourlyRateCents ?? 0) / 100,
    dayRate: (entry.dayRateCents ?? 0) / 100,
    minimumCharge: (entry.minimumChargeCents ?? 0) / 100,
    visibility: entry.visibility,
    notes: entry.notes ?? "",
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
}

async function rateRequest(init?: RequestInit) {
  const response = await fetchWithTimeout(apiPath("/api/v1/profile/rates"), {
    credentials: "include",
    ...init,
  });
  const body = await response.json().catch(() => ({})) as { data?: { rates?: ServerRateCardEntry[] }; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || "Rate card could not be saved.");
  return (body.data?.rates ?? []).map(fromServer);
}

export async function fetchRateCardEntries() {
  const rates = await rateRequest();
  persistRateCardEntries(rates);
  return rates;
}

export async function saveRateCardEntries(entries: RateCardEntry[]) {
  const rates = await rateRequest({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: entries.map((entry) => ({
      tradeCode: entry.tradeCode,
      hourlyRateCents: entry.hourlyRate > 0 ? Math.round(entry.hourlyRate * 100) : null,
      dayRateCents: entry.dayRate > 0 ? Math.round(entry.dayRate * 100) : null,
      minimumChargeCents: entry.minimumCharge > 0 ? Math.round(entry.minimumCharge * 100) : null,
      visibility: entry.visibility,
      notes: entry.notes,
    })) }),
  });
  persistRateCardEntries(rates);
  return rates;
}
