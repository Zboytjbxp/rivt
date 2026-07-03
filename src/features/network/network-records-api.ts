import { apiPath, requestKey } from "../../lib/api";

export type NetworkRecordType = "crew_member" | "crew_invite" | "network_review";

export interface ServerNetworkRecord {
  id: string;
  recordType: NetworkRecordType;
  localId: string;
  title: string;
  status: string;
  recordDate: string | null;
  payload: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NetworkRecordInput {
  recordType: NetworkRecordType;
  localId: string;
  title: string;
  status?: string;
  recordDate?: string | null;
  payload?: Record<string, unknown>;
}

export async function fetchNetworkRecords(recordType?: NetworkRecordType): Promise<ServerNetworkRecord[] | null> {
  try {
    const suffix = recordType ? `?type=${encodeURIComponent(recordType)}` : "";
    const response = await fetch(apiPath(`/api/v1/network-records${suffix}`), { credentials: "include" });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { records?: ServerNetworkRecord[] } } | null;
    return Array.isArray(body?.data?.records) ? body!.data!.records! : null;
  } catch {
    return null;
  }
}

export async function upsertNetworkRecord(input: NetworkRecordInput): Promise<ServerNetworkRecord | null> {
  try {
    const response = await fetch(apiPath("/api/v1/network-records"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestKey(),
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { record?: ServerNetworkRecord } } | null;
    return body?.data?.record ?? null;
  } catch {
    return null;
  }
}

export async function deleteNetworkRecordByLocalId(recordType: NetworkRecordType, localId: string): Promise<boolean> {
  try {
    const response = await fetch(
      apiPath(`/api/v1/network-records/${encodeURIComponent(recordType)}/${encodeURIComponent(localId)}`),
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Idempotency-Key": requestKey() },
      },
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
