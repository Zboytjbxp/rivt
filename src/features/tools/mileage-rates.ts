export interface MileageDatedValue {
  date: string;
  miles: number;
}

interface MileageRatePeriod {
  startsOn: string;
  endsOn: string;
  rate: number;
}

const BUSINESS_MILEAGE_RATE_PERIODS: MileageRatePeriod[] = [
  { startsOn: "2024-01-01", endsOn: "2024-12-31", rate: 0.67 },
  { startsOn: "2025-01-01", endsOn: "2025-12-31", rate: 0.70 },
  { startsOn: "2026-01-01", endsOn: "2026-06-30", rate: 0.725 },
  { startsOn: "2026-07-01", endsOn: "2026-12-31", rate: 0.76 },
];

function canonicalDate(value: string) {
  const date = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function rateText(rate: number) {
  return `$${rate.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}/mi`;
}

function monthDay(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(2020, month - 1, day)));
}

export function mileageRateForDate(value: string) {
  const date = canonicalDate(value);
  if (!date) return null;
  return BUSINESS_MILEAGE_RATE_PERIODS.find((period) => date >= period.startsOn && date <= period.endsOn)?.rate ?? null;
}

export function mileageRateLabelForDate(value: string) {
  const rate = mileageRateForDate(value);
  return rate === null ? "Rate unavailable" : rateText(rate);
}

export function mileageDeductionForEntry(entry: MileageDatedValue) {
  const rate = mileageRateForDate(entry.date);
  const miles = Number.isFinite(entry.miles) ? Math.max(0, entry.miles) : 0;
  return rate === null ? 0 : Number((miles * rate).toFixed(2));
}

export function mileageDeductionForEntries(entries: MileageDatedValue[]) {
  let deduction = 0;
  let ratedMiles = 0;
  let unratedMiles = 0;

  for (const entry of entries) {
    const miles = Number.isFinite(entry.miles) ? Math.max(0, entry.miles) : 0;
    const rate = mileageRateForDate(entry.date);
    if (rate === null) {
      unratedMiles += miles;
      continue;
    }
    ratedMiles += miles;
    deduction += miles * rate;
  }

  return {
    deduction: Number(deduction.toFixed(2)),
    ratedMiles: Number(ratedMiles.toFixed(2)),
    unratedMiles: Number(unratedMiles.toFixed(2)),
  };
}

export function mileageRateSummaryForYear(year: number) {
  const yearPrefix = `${year}-`;
  const periods = BUSINESS_MILEAGE_RATE_PERIODS.filter((period) => period.startsOn.startsWith(yearPrefix));
  if (!periods.length) return "No built-in IRS rate for this year";
  if (periods.length === 1) return rateText(periods[0].rate);
  return periods
    .map((period, index) => index === 0
      ? `${rateText(period.rate)} through ${monthDay(period.endsOn)}`
      : `${rateText(period.rate)} from ${monthDay(period.startsOn)}`)
    .join("; ");
}
