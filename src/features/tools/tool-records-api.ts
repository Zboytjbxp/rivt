import { apiPath, fetchWithTimeout, notifySessionExpired, requestKey } from "../../lib/api";

export type ToolRecordType =
  | "payment_record"
  | "invoice_template"
  | "invoice_draft"
  | "estimate"
  | "expense"
  | "mileage"
  | "time_session"
  | "bid"
  | "price_book"
  | "punch_item"
  | "daily_report"
  | "safety_check"
  | "job_checklist"
  | "client";

export interface ServerToolRecord {
  id: string;
  recordType: ToolRecordType;
  localId: string;
  title: string;
  status: string;
  recordDate: string | null;
  amountCents: number | null;
  standaloneProjectId: string | null;
  activeWorkId: string | null;
  payload: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ToolRecordInput {
  recordType: ToolRecordType;
  localId: string;
  title: string;
  status?: string;
  recordDate?: string | null;
  amountCents?: number | null;
  standaloneProjectId?: string | null;
  activeWorkId?: string | null;
  payload?: Record<string, unknown>;
}

export async function fetchToolRecords(recordType?: ToolRecordType): Promise<ServerToolRecord[] | null> {
  try {
    const suffix = recordType ? `?type=${encodeURIComponent(recordType)}` : "";
    const response = await fetchWithTimeout(apiPath(`/api/v1/tool-records${suffix}`), { credentials: "include" });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { records?: ServerToolRecord[] } } | null;
    return Array.isArray(body?.data?.records) ? body!.data!.records! : null;
  } catch {
    return null;
  }
}

export async function upsertToolRecord(input: ToolRecordInput): Promise<ServerToolRecord | null> {
  try {
    const response = await fetchWithTimeout(apiPath("/api/v1/tool-records"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestKey(),
      },
      body: JSON.stringify(input),
    });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { record?: ServerToolRecord } } | null;
    return body?.data?.record ?? null;
  } catch {
    return null;
  }
}

export async function deleteToolRecordByLocalId(recordType: ToolRecordType, localId: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      apiPath(`/api/v1/tool-records/${encodeURIComponent(recordType)}/${encodeURIComponent(localId)}`),
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Idempotency-Key": requestKey() },
      },
    );
    if (response.status === 401) notifySessionExpired();
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
