const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function clampNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function currency(value: number) {
  return usdFormatter.format(Number.isFinite(value) ? value : 0);
}

export function toCents(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

export function centsToDollars(cents: number) {
  return cents / 100;
}

export function formatQuantity(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.0+$/, "");
}
