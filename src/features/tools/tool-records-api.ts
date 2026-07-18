import { apiPath, fetchWithTimeout, notifySessionExpired, requestKey, RivtApiError } from "../../lib/api";

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

export async function sendEstimateByLocalId(localId: string, idempotencyKey: string = requestKey()): Promise<ServerToolRecord> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/estimates/${encodeURIComponent(localId)}/send`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const body = await response.json().catch(() => null) as { data?: { record?: ServerToolRecord }; error?: { code?: string; message?: string; details?: unknown } } | null;
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) {
    throw new RivtApiError(response.status, body ?? {}, "RIVT could not send the estimate.");
  }
  if (!body?.data?.record) {
    throw new RivtApiError(502, { error: { code: "ESTIMATE_SEND_RESPONSE_INVALID", message: "RIVT could not confirm that estimate delivery." } });
  }
  return body.data.record;
}

export async function sendInvoiceByLocalId(localId: string, idempotencyKey: string = requestKey()): Promise<ServerToolRecord> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/invoices/${encodeURIComponent(localId)}/send`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const body = await response.json().catch(() => null) as { data?: { record?: ServerToolRecord }; error?: { code?: string; message?: string; details?: unknown } } | null;
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) {
    throw new RivtApiError(response.status, body ?? {}, "RIVT could not send the invoice.");
  }
  if (!body?.data?.record) {
    throw new RivtApiError(502, { error: { code: "INVOICE_SEND_RESPONSE_INVALID", message: "RIVT could not confirm that invoice delivery." } });
  }
  return body.data.record;
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
