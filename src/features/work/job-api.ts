import type { Difficulty, Job, Trade, WorkType } from "../../types";
import { type ApiErrorBody, RivtApiError, requestKey, makeRequest } from "../../lib/api";

export type CanonicalJobStatus = "draft" | "open" | "paused" | "closed";
export type CanonicalDifficulty = "easy" | "moderate" | "challenging" | "advanced" | "expert";
export type CanonicalWorkType = "side_work" | "emergency" | "multi_day" | "inspection_prep";
export type CanonicalCompensationType = "fixed" | "hourly" | "open_to_offers" | "request_quotes";
export type CompensationUnit = "fixed" | "hourly";

export interface CanonicalRateCardEntry {
  tradeCode: string;
  tradeName: string;
  hourlyRateCents: number | null;
  dayRateCents: number | null;
  minimumChargeCents: number | null;
  visibility: "network" | "applications" | "private";
}

export interface CanonicalJob {
  id: string;
  organization: { id: string; name: string };
  createdByAccountId: string;
  title: string;
  trade: { code: string; name: string };
  summary: string;
  scopeDescription: string;
  status: CanonicalJobStatus;
  difficulty: CanonicalDifficulty;
  workType: CanonicalWorkType;
  compensationType: CanonicalCompensationType;
  budget: { amountCents: number; currency: "USD"; unit: CompensationUnit } | null;
  durationHours: number | null;
  preferredStartDate: string | null;
  applicationDeadline: string | null;
  insuranceRequired: boolean;
  publicLocation: { city: string; region: string; countryCode: string; postalPrefix: string | null };
  privateLocation?: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
    accessNotes: string;
  };
  requirements: {
    tools: string[];
    materials: string[];
    deliverables: string[];
    certificationCodes: string[];
  };
  addressPrivacy: string;
  matchScore: number | null;
  version: number;
  publishedAt: string | null;
  pausedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: Array<{
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string;
    occurredAt: string;
  }>;
}

export interface JobEditorInput {
  organizationId: string;
  title: string;
  tradeCode: string;
  summary: string;
  scopeDescription: string;
  difficulty: CanonicalDifficulty;
  workType: CanonicalWorkType;
  budgetCents: number | null;
  budgetUnit: CompensationUnit;
  compensationType: CanonicalCompensationType;
  durationHours: number | null;
  preferredStartDate: string | null;
  applicationDeadline: string | null;
  insuranceRequired: boolean;
  tools: string[];
  materials: string[];
  deliverables: string[];
  certificationCodes: string[];
  publicLocation: { city: string; region: string; countryCode: string; postalPrefix: string | null };
  privateLocation: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
    accessNotes: string;
  } | null;
}

export type CanonicalApplicationStatus = "draft" | "submitted" | "withdrawn" | "shortlisted" | "declined" | "offered";
export type CanonicalOfferStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";
export type CanonicalActiveWorkStatus = "active" | "cancelled" | "completed";

export interface CanonicalTimelineEvent {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  occurredAt: string;
}

export interface CanonicalApplication {
  id: string;
  jobId: string;
  applicantAccountId: string;
  status: CanonicalApplicationStatus;
  message: string;
  proposedStartDate: string | null;
  proposal: { amountCents: number; unit: CompensationUnit } | null;
  submittedAt: string | null;
  withdrawnAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    accountId: string;
    displayName: string;
    headline: string;
    serviceArea: { city: string; region: string };
    rates: CanonicalRateCardEntry[];
  };
  events: CanonicalTimelineEvent[];
}

export interface CanonicalOffer {
  id: string;
  jobId: string;
  applicationId: string;
  contractorAccountId: string;
  recipientAccountId: string;
  status: CanonicalOfferStatus;
  startDate: string | null;
  scopeSummary: string;
  message: string;
  agreedCompensation: { amountCents: number; unit: CompensationUnit } | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipient?: {
    accountId: string;
    displayName: string;
    headline: string;
    serviceArea: { city: string; region: string };
  };
  events: CanonicalTimelineEvent[];
}

export interface CanonicalActiveWork {
  id: string;
  jobId: string;
  offerId: string;
  organizationId: string;
  contractorAccountId: string;
  tradespersonAccountId: string;
  status: CanonicalActiveWorkStatus;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    title: string;
    status: string;
    organization: { id: string; name: string };
    trade?: { code: string; name: string };
    durationHours: number | null;
    budget: {
      amountCents: number;
      currency: "USD";
      unit: "fixed" | "hourly";
    } | null;
    publicLocation: { city: string; region: string; countryCode: string };
    privateLocation?: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      region: string;
      postalCode: string;
      countryCode: string;
      accessNotes: string;
    };
  };
  events: CanonicalTimelineEvent[];
}

export class JobApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the job request.");
    const message = formatJobApiMessage(this.code, this.message, this.details);
    if (message) this.message = message;
    this.name = "JobApiError";
  }
}

const request = makeRequest((s, b) => new JobApiError(s, b));

const jobFieldLabels: Record<string, string> = {
  expectedVersion: "draft version",
  consentAccepted: "job consent",
  consentVersion: "consent version",
  title: "job title",
  tradeCode: "trade",
  summary: "short summary",
  scopeDescription: "scope description",
  budgetCents: "pay",
  durationHours: "duration",
  preferredStartDate: "preferred start date",
  publicLocation: "public city/state",
  privateLocation: "exact jobsite address",
  applicationDeadline: "application deadline",
  startDate: "offer start date",
  expiresAt: "offer expiration",
};

function formatJobApiMessage(code: string, fallback: string, details: unknown) {
  if (code === "JOB_NOT_READY" && isRecord(details) && Array.isArray(details.missing)) {
    const missing = details.missing.map((field) => jobFieldLabels[String(field)] ?? String(field));
    return `Publish blocked. Complete ${missing.join(", ")}.`;
  }
  if (code === "VALIDATION_FAILED" && isRecord(details) && Array.isArray(details.issues)) {
    const fields = details.issues
      .map((issue) => isRecord(issue) ? String(issue.path || "") : "")
      .filter(Boolean)
      .map((path) => jobFieldLabels[path] ?? path)
      .filter((value, index, all) => all.indexOf(value) === index);
    if (fields.length) return `Request validation failed for ${fields.join(", ")}. Refresh the draft and try again.`;
  }
  if (code === "JOB_VERSION_CONFLICT") return "This draft changed since it loaded. Refresh it and try publishing again.";
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export interface JobListFilters {
  query?: string;
  trade?: string;
  difficulty?: CanonicalDifficulty;
  workType?: CanonicalWorkType;
  city?: string;
  region?: string;
  insuranceRequired?: boolean;
}

export async function listJobs(filters: JobListFilters = {}) {
  const search = new URLSearchParams({ limit: "100" });
  if (filters.query) search.set("q", filters.query);
  if (filters.trade) search.set("trade", filters.trade);
  if (filters.difficulty) search.set("difficulty", filters.difficulty);
  if (filters.workType) search.set("workType", filters.workType);
  if (filters.city) search.set("city", filters.city);
  if (filters.region) search.set("region", filters.region);
  if (filters.insuranceRequired !== undefined) search.set("insuranceRequired", String(filters.insuranceRequired));
  const body = await request<{ data: { jobs: CanonicalJob[] }; meta: { nextCursor: string | null } }>(`/api/v1/jobs?${search}`);
  return body.data.jobs;
}

export async function getJob(jobId: string) {
  const body = await request<{ data: { job: CanonicalJob } }>(`/api/v1/jobs/${jobId}`);
  return body.data.job;
}

export async function createJob(input: JobEditorInput) {
  const body = await request<{ data: { job: CanonicalJob } }>("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify(input),
  });
  return body.data.job;
}

export async function updateJob(jobId: string, expectedVersion: number, input: Partial<JobEditorInput>) {
  const { organizationId: _organizationId, ...editable } = input;
  void _organizationId;
  const body = await request<{ data: { job: CanonicalJob } }>(`/api/v1/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ ...editable, expectedVersion }),
  });
  return body.data.job;
}

export async function transitionJob(jobId: string, action: "publish" | "pause" | "resume" | "close", expectedVersion: number) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new JobApiError(422, {
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed.",
        details: { issues: [{ path: "expectedVersion", code: "invalid_type", message: "Expected a positive draft version." }] },
      },
    });
  }
  const payload = action === "publish"
    ? { expectedVersion, consentAccepted: true, consentVersion: "2026-06-19" }
    : { expectedVersion, reason: "Updated by the contractor" };
  const body = await request<{ data: { job: CanonicalJob } }>(`/api/v1/jobs/${jobId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify(payload),
  });
  return body.data.job;
}

export async function saveApplicationDraft(jobId: string, input: { message: string; proposedStartDate?: string | null; proposedAmountCents?: number | null; proposedUnit?: CompensationUnit | null }) {
  const body = await request<{ data: { application: CanonicalApplication } }>(`/api/v1/jobs/${jobId}/application-draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ message: input.message, proposedStartDate: input.proposedStartDate ?? null, proposedAmountCents: input.proposedAmountCents ?? null, proposedUnit: input.proposedUnit ?? null }),
  });
  return body.data.application;
}

export async function submitApplication(jobId: string, input: { message: string; proposedStartDate?: string | null; proposedAmountCents?: number | null; proposedUnit?: CompensationUnit | null }) {
  const body = await request<{ data: { application: CanonicalApplication } }>(`/api/v1/jobs/${jobId}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({
      message: input.message,
      proposedStartDate: input.proposedStartDate ?? null,
      proposedAmountCents: input.proposedAmountCents ?? null,
      proposedUnit: input.proposedUnit ?? null,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    }),
  });
  return body.data.application;
}

export async function withdrawApplication(applicationId: string, reason = "Applicant withdrew") {
  const body = await request<{ data: { application: CanonicalApplication } }>(`/api/v1/applications/${applicationId}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.application;
}

export async function listMyApplications() {
  const body = await request<{ data: { applications: CanonicalApplication[] } }>("/api/v1/applications");
  return body.data.applications;
}

export async function listJobApplications(jobId: string) {
  const body = await request<{ data: { applications: CanonicalApplication[] } }>(`/api/v1/jobs/${jobId}/applications`);
  return body.data.applications;
}

export async function shortlistApplication(applicationId: string) {
  const body = await request<{ data: { application: CanonicalApplication } }>(`/api/v1/applications/${applicationId}/shortlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason: "Shortlisted by contractor" }),
  });
  return body.data.application;
}

export async function declineApplication(applicationId: string) {
  const body = await request<{ data: { application: CanonicalApplication } }>(`/api/v1/applications/${applicationId}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason: "Not selected for this work" }),
  });
  return body.data.application;
}

export async function sendOffer(applicationId: string, input: { startDate?: string | null; scopeSummary: string; message: string; agreedAmountCents: number; agreedUnit: CompensationUnit }) {
  const body = await request<{ data: { offer: CanonicalOffer; application: CanonicalApplication } }>(`/api/v1/applications/${applicationId}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ ...input, startDate: input.startDate ?? null, expiresAt: null }),
  });
  return body.data;
}

export async function listOffers() {
  const body = await request<{ data: { offers: CanonicalOffer[] } }>("/api/v1/offers");
  return body.data.offers;
}

export async function acceptOffer(offerId: string, reason = "Offer accepted") {
  const body = await request<{ data: { offer: CanonicalOffer; activeWork: CanonicalActiveWork } }>(`/api/v1/offers/${offerId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason, consentAccepted: true, consentVersion: "2026-06-19" }),
  });
  return body.data;
}

export async function declineOffer(offerId: string, reason = "Offer declined") {
  const body = await request<{ data: { offer: CanonicalOffer } }>(`/api/v1/offers/${offerId}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.offer;
}

export async function listActiveWork() {
  const body = await request<{ data: { activeWork: CanonicalActiveWork[] } }>("/api/v1/active-work");
  return body.data.activeWork;
}

export async function requestWorkReschedule(activeWorkId: string, reason: string) {
  const body = await request<{ data: { activeWork: CanonicalActiveWork } }>(`/api/v1/active-work/${activeWorkId}/reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.activeWork;
}

export async function cancelActiveWork(activeWorkId: string, reason: string) {
  const body = await request<{ data: { activeWork: CanonicalActiveWork } }>(`/api/v1/active-work/${activeWorkId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.activeWork;
}

const difficultyLabels: Record<CanonicalDifficulty, Difficulty> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
  advanced: "Advanced",
  expert: "Expert",
};

const workTypeLabels: Record<CanonicalWorkType, WorkType> = {
  side_work: "Side work",
  emergency: "Emergency",
  multi_day: "Multi-day",
  inspection_prep: "Inspection prep",
};

const statusLabels: Record<CanonicalJobStatus, Job["status"]> = {
  draft: "Draft",
  open: "Open",
  paused: "Paused",
  closed: "Closed",
};

function postedLabel(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function toJobViewModel(job: CanonicalJob): Job {
  const displayId = Number.parseInt(job.id.replaceAll("-", "").slice(0, 12), 16);
  return {
    id: displayId,
    title: job.title,
    contractor: job.organization.name,
    trade: job.trade.name as Trade,
    location: `${job.publicLocation.city}, ${job.publicLocation.region}`,
    state: job.publicLocation.region,
    distance: 0,
    pay: Math.round((job.budget?.amountCents ?? 0) / 100),
    durationHours: job.durationHours ?? 0,
    workType: workTypeLabels[job.workType],
    difficulty: difficultyLabels[job.difficulty],
    insuranceRequired: job.insuranceRequired,
    tools: job.requirements.tools,
    trustRequirement: "Legal agreement required",
    addressPolicy: job.addressPrivacy,
    posted: postedLabel(job.publishedAt ?? job.updatedAt),
    match: job.matchScore ?? 0,
    rating: 0,
    reviewCount: 0,
    applicants: 0,
    status: statusLabels[job.status],
    summary: job.summary || "Draft scope in progress.",
    guidance: job.requirements.materials,
    risks: [],
    deliverables: job.requirements.deliverables,
    matchFactors: job.matchScore === null ? [] : ["Trade and service-area fit"],
    requiredQuizIds: job.requirements.certificationCodes,
    canonical: {
      id: job.id,
      organizationId: job.organization.id,
      tradeCode: job.trade.code,
      version: job.version,
      scopeDescription: job.scopeDescription,
      materials: job.requirements.materials,
      publicLocation: job.publicLocation,
      privateLocation: job.privateLocation,
      preferredStartDate: job.preferredStartDate,
      applicationDeadline: job.applicationDeadline,
      budgetUnit: job.budget?.unit ?? "fixed",
      compensationType: job.compensationType,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      events: job.events,
    },
  };
}
