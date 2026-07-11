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

export interface ProjectInvoiceLine {
  description: string;
  quantity: number;
  rateCents: number;
  kind: "labor" | "material" | "other" | "adjustment";
}

export interface ProjectInvoicePayment {
  id: string;
  invoiceId: string;
  projectId: string;
  activeWorkId: string;
  recordedByAccountId: string;
  amountCents: number;
  paymentDate: string;
  method: string;
  note: string;
  createdAt: string | null;
}

export interface ProjectInvoice {
  id: string;
  projectId: string;
  activeWorkId: string;
  createdByAccountId: string;
  invoiceNumber: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  status: "draft" | "sent" | "paid" | "void";
  lineItems: ProjectInvoiceLine[];
  sourceEstimate: Record<string, unknown>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  payments: ProjectInvoicePayment[];
}

export interface ReviewContext {
  activeWorkId: string;
  eligible: boolean;
  hasSubmitted: boolean;
  counterparty: { accountId: string; displayName: string; headline: string } | null;
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
  invoices: ProjectInvoice[];
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

export async function getProjectForActiveWork(activeWorkId: string) {
  const body = await request<{ data: { project: ProjectRecord } }>(`/api/v1/active-work/${activeWorkId}/project`);
  return body.data.project;
}

export async function createProjectInvoice(activeWorkId: string, input: {
  invoiceNumber: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxCents: number;
  lineItems: ProjectInvoiceLine[];
  sourceEstimate?: Record<string, unknown>;
}) {
  const body = await request<{ data: { invoice: ProjectInvoice } }>(`/api/v1/active-work/${activeWorkId}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify(input),
  });
  return body.data.invoice;
}

export async function updateProjectInvoiceStatus(invoiceId: string, status: "draft" | "sent" | "void") {
  const body = await request<{ data: { invoice: ProjectInvoice } }>(`/api/v1/project-invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ status }),
  });
  return body.data.invoice;
}

export async function recordProjectInvoicePayment(invoiceId: string, input: {
  amountCents: number;
  paymentDate: string;
  method: string;
  note: string;
}) {
  const body = await request<{ data: { invoice: ProjectInvoice } }>(`/api/v1/project-invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify(input),
  });
  return body.data.invoice;
}

export async function getActiveWorkReviewContext(activeWorkId: string) {
  const body = await request<{ data: { reviewContext: ReviewContext } }>(`/api/v1/active-work/${activeWorkId}/review-context`);
  return body.data.reviewContext;
}

export async function submitActiveWorkReview(activeWorkId: string, input: { revieweeAccountId: string; rating: number; body: string; consentVersion: string }) {
  const body = await request<{ data: { review: unknown } }>(`/api/v1/active-work/${activeWorkId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ ...input, consentAccepted: true }),
  });
  return body.data.review;
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
