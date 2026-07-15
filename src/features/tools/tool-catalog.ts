export const PUBLIC_TOOL_MODES = [
  "calculator",
  "estimate",
  "invoice",
  "materials",
  "daily-log",
  "job-photos",
  "time-costs",
  "time-tracker",
  "expense-logger",
  "mileage",
  "price-book",
  "safety-checklist",
  "punch-list",
  "payments",
  "tax-summary",
] as const;

export const CONTAINED_TOOL_MODES = [
  "earnings",
  "bid-builder",
  "tax-estimator",
  "contracts",
  "job-checklist",
  "daily-report",
] as const;

export type PublicToolMode = (typeof PUBLIC_TOOL_MODES)[number];
export type ContainedToolMode = (typeof CONTAINED_TOOL_MODES)[number];
export type ToolMode = "hub" | PublicToolMode | ContainedToolMode;

const publicToolModes = new Set<string>(PUBLIC_TOOL_MODES);

export function isPublicToolMode(value: unknown): value is PublicToolMode {
  return typeof value === "string" && publicToolModes.has(value);
}
