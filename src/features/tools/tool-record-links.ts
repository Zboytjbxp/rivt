import type { ToolMode } from "./tool-catalog";
import type { ToolRecordType } from "./tool-records-api";

export function linkedRecordTypeForTool(tool: ToolMode | null): ToolRecordType | null {
  if (tool === "estimate") return "estimate";
  if (tool === "invoice") return "invoice_draft";
  return null;
}
