import { makeRequest, requestKey, RivtApiError, type ApiErrorBody } from "../../lib/api";

export type WorkspaceRecordType = "checklist" | "milestone" | "change_order" | "note";
export type WorkspaceRecordVisibility = "shared" | "private";
export type WorkspaceRecordState =
  | "open"
  | "done"
  | "pending"
  | "paid"
  | "overdue"
  | "approved"
  | "rejected"
  | "active";

export interface WorkspaceRecord {
  id: string;
  projectId: string;
  activeWorkId: string;
  recordType: WorkspaceRecordType;
  visibility: WorkspaceRecordVisibility;
  title: string;
  details: string;
  requestedBy: string;
  amountCents: number;
  dueNote: string;
  state: WorkspaceRecordState;
  version: number;
  createdByAccountId: string;
  updatedByAccountId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRecordEvent {
  id: string;
  projectId: string;
  recordId: string;
  recordType: WorkspaceRecordType;
  actorAccountId: string;
  actorDisplayName: string;
  actorRole: "contractor" | "tradesperson" | null;
  eventType: "created" | "updated" | "state_changed" | "archived";
  priorVersion: number | null;
  nextVersion: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkspaceRecordCreate {
  recordType: WorkspaceRecordType;
  visibility?: WorkspaceRecordVisibility;
  title?: string;
  details?: string;
  requestedBy?: string;
  amountCents?: number;
  dueNote?: string;
  state: WorkspaceRecordState;
}

export interface WorkspaceRecordUpdate {
  expectedVersion: number;
  visibility?: WorkspaceRecordVisibility;
  title?: string;
  details?: string;
  requestedBy?: string;
  amountCents?: number;
  dueNote?: string;
  state?: WorkspaceRecordState;
}

export class WorkspaceRecordsApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not update this job record.");
    this.name = "WorkspaceRecordsApiError";
  }
}

const request = makeRequest((status, body) => new WorkspaceRecordsApiError(status, body));

function mutationOptions(method: "POST" | "PATCH" | "DELETE", body: unknown, idempotencyKey = requestKey()) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  };
}

export async function listWorkspaceRecords(projectId: string) {
  const body = await request<{
    data: { records: WorkspaceRecord[]; archivedRecords: WorkspaceRecord[]; events: WorkspaceRecordEvent[] };
  }>(`/api/v1/projects/${projectId}/workspace-records`);
  return body.data;
}

export async function createWorkspaceRecord(projectId: string, input: WorkspaceRecordCreate, idempotencyKey = requestKey()) {
  const body = await request<{ data: { record: WorkspaceRecord } }>(
    `/api/v1/projects/${projectId}/workspace-records`,
    mutationOptions("POST", input, idempotencyKey),
  );
  return body.data.record;
}

export async function updateWorkspaceRecord(projectId: string, recordId: string, input: WorkspaceRecordUpdate) {
  const body = await request<{ data: { record: WorkspaceRecord } }>(
    `/api/v1/projects/${projectId}/workspace-records/${recordId}`,
    mutationOptions("PATCH", input),
  );
  return body.data.record;
}

export async function archiveWorkspaceRecord(projectId: string, recordId: string, expectedVersion: number) {
  const body = await request<{ data: { record: WorkspaceRecord } }>(
    `/api/v1/projects/${projectId}/workspace-records/${recordId}`,
    mutationOptions("DELETE", { expectedVersion }),
  );
  return body.data.record;
}

export async function restoreWorkspaceRecord(projectId: string, recordId: string, expectedVersion: number) {
  const body = await request<{ data: { record: WorkspaceRecord } }>(
    `/api/v1/projects/${projectId}/workspace-records/${recordId}/restore`,
    mutationOptions("POST", { expectedVersion }),
  );
  return body.data.record;
}
