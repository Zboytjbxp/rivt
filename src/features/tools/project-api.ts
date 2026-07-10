import { type ApiErrorBody, RivtApiError, UPLOAD_REQUEST_TIMEOUT_MS, apiPath, fetchWithTimeout, requestKey, makeRequest, notifySessionExpired } from "../../lib/api";

export class ProjectApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the project-record request.");
    this.name = "ProjectApiError";
  }
}

export interface ProjectEntry {
  id: string;
  projectId: string;
  actorAccountId: string;
  entryType: "note" | "media" | "completion_submitted" | "completion_confirmed" | "completion_disputed" | "system";
  body: string;
  checklist: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectMedia {
  id: string;
  projectId: string;
  uploadId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
  mediaKind: "photo" | "document" | "other";
  status: "pending" | "stored" | "failed" | "rejected" | "removed";
  reviewStatus: "not_scanned" | "accepted" | "rejected";
  failureReason: string;
  createdAt: string;
  signedUrl?: string | null;
}

export interface ProjectCompletion {
  id: string;
  projectId: string;
  submittedByAccountId: string;
  note: string;
  checklist: Record<string, unknown>;
  evidenceMediaIds: string[];
  status: "submitted" | "confirmed" | "disputed";
  submittedAt: string;
  resolvedAt: string | null;
  resolutions: Array<{
    id: string;
    decision: "confirmed" | "disputed";
    reason: string;
    actorAccountId: string;
    createdAt: string;
  }>;
}

export interface ProjectRecord {
  id: string;
  activeWorkId: string;
  jobId: string;
  organizationId: string;
  status: "open" | "completion_submitted" | "confirmed" | "disputed";
  contractorAccountId: string;
  tradespersonAccountId: string;
  job: {
    title: string;
    status: string;
    publicLocation: { city: string; region: string; countryCode: string };
  };
  entries: ProjectEntry[];
  media: ProjectMedia[];
  completionSubmissions: ProjectCompletion[];
  updatedAt: string;
}

const request = makeRequest((s, b) => new ProjectApiError(s, b));

export async function openProjectForActiveWork(activeWorkId: string) {
  const body = await request<{ data: { project: ProjectRecord } }>(`/api/v1/active-work/${activeWorkId}/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({}),
  });
  return body.data.project;
}

export async function addProjectNote(projectId: string, body: string) {
  const result = await request<{ data: { entry: ProjectEntry } }>(`/api/v1/projects/${projectId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ body }),
  });
  return result.data.entry;
}

export async function uploadProjectMedia(projectId: string, file: File, notes = "") {
  const form = new FormData();
  form.append("name", file.name);
  form.append("notes", notes);
  form.append("file", file);
  const response = await fetchWithTimeout(apiPath(`/api/v1/projects/${projectId}/media`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": requestKey() },
    body: form,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  const body = await response.json().catch(() => ({})) as ApiErrorBody & {
    data?: { media: ProjectMedia; entry?: ProjectEntry };
  };
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) throw new ProjectApiError(response.status, body);
  return body.data;
}

export async function submitProjectCompletion(
  projectId: string,
  note: string,
  evidenceMediaIds: string[],
  checklist: { completedOnTime?: boolean; clientApproved?: boolean; photosProvided?: boolean } = {},
) {
  const body = await request<{ data: { completion: ProjectCompletion } }>(`/api/v1/projects/${projectId}/completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({
      note,
      evidenceMediaIds,
      checklist: {
        completedOnTime: checklist.completedOnTime ?? true,
        clientApproved: checklist.clientApproved ?? false,
        photosProvided: checklist.photosProvided ?? evidenceMediaIds.length > 0,
      },
    }),
  });
  return body.data.completion;
}

export async function resolveProjectCompletion(projectId: string, completionId: string, decision: "confirm" | "dispute", reason: string) {
  const body = await request<{ data: { completion: ProjectCompletion } }>(`/api/v1/projects/${projectId}/completion/${completionId}/${decision}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.completion;
}

export async function getProject(projectId: string) {
  const body = await request<{ data: { project: ProjectRecord } }>(`/api/v1/projects/${projectId}`);
  return body.data.project;
}

export async function getProjectReport(projectId: string) {
  const body = await request<{ data: { report: unknown } }>(`/api/v1/projects/${projectId}/report`);
  return body.data.report;
}
