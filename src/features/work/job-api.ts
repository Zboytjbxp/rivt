import type { Difficulty, Job, Trade, WorkType } from "../../types";

export type CanonicalJobStatus = "draft" | "open" | "paused" | "closed";
export type CanonicalDifficulty = "easy" | "moderate" | "challenging" | "advanced" | "expert";
export type CanonicalWorkType = "side_work" | "emergency" | "multi_day" | "inspection_prep";

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
  budget: { amountCents: number; currency: "USD"; unit: "fixed" | "hourly" } | null;
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
  budgetUnit: "fixed" | "hourly";
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

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export class JobApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message || "RIVT could not complete the job request.");
    this.name = "JobApiError";
    this.status = status;
    this.code = body.error?.code || "REQUEST_FAILED";
    this.details = body.error?.details;
  }
}

function apiPath(path: string) {
  const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  return `${base}${path}`;
}

function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? `rivt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(apiPath(path), { credentials: "include", ...options });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (!response.ok) throw new JobApiError(response.status, body);
  return body;
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
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      events: job.events,
    },
  };
}
