import { apiPath, fetchWithTimeout, requestKey, UPLOAD_REQUEST_TIMEOUT_MS } from "../../lib/api";

export type ProfileVisibility = "private" | "network";
export type ProfessionalRecordStatus = "active" | "archived";
export type CredentialKind = "license" | "certification" | "training" | "insurance" | "other";
export type AvailabilityValue = "available" | "limited" | "unavailable";

export interface ProfileCredential {
  id: string;
  kind: CredentialKind;
  name: string;
  issuer: string;
  credentialNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string;
  evidenceState: "self_reported" | "evidence_on_file";
  evidenceUploadId: string | null;
  evidenceUrl: string | null;
  visibility: ProfileVisibility;
  status: ProfessionalRecordStatus;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAvailabilityWindow {
  id: string;
  availability: AvailabilityValue;
  startsOn: string;
  endsOn: string;
  notes: string;
  visibility: ProfileVisibility;
  status: ProfessionalRecordStatus;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePortfolioItem {
  id: string;
  uploadId: string;
  title: string;
  description: string;
  tradeCode: string | null;
  tradeName: string | null;
  projectLabel: string;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  completedOn: string | null;
  visibility: ProfileVisibility;
  status: ProfessionalRecordStatus;
  sortOrder: number;
  version: number;
  imageUrl: string | null;
  imageAlt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfileEvent {
  id: string;
  subjectType: "credential" | "availability_window" | "portfolio_item" | "avatar";
  subjectId: string;
  action: string;
  fromVersion: number | null;
  toVersion: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OwnProfessionalProfile {
  avatarUploadId: string | null;
  avatarUrl: string | null;
  credentials: ProfileCredential[];
  availabilityWindows: ProfileAvailabilityWindow[];
  portfolioItems: ProfilePortfolioItem[];
  events: ProfessionalProfileEvent[];
}

export interface NetworkProfessionalProfile {
  accountId: string;
  displayName: string;
  headline: string;
  bio: string;
  primaryRole: "contractor" | "tradesperson";
  locationText: string;
  serviceArea: { city: string; region: string; radiusMiles: number };
  availabilityStatus: AvailabilityValue;
  avatarUrl: string | null;
  trades: Array<{ code: string; name: string; primary: boolean }>;
  rateCards: Array<{
    tradeCode: string;
    tradeName: string;
    hourlyRateCents: number | null;
    dayRateCents: number | null;
    minimumChargeCents: number | null;
    notes: string;
  }>;
  credentials: ProfileCredential[];
  availabilityWindows: ProfileAvailabilityWindow[];
  portfolioItems: ProfilePortfolioItem[];
}

export interface CredentialInput {
  kind: CredentialKind;
  name: string;
  issuer: string;
  credentialNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string;
  visibility: ProfileVisibility;
}

export interface AvailabilityWindowInput {
  availability: AvailabilityValue;
  startsOn: string;
  endsOn: string;
  notes: string;
  visibility: ProfileVisibility;
}

export interface PortfolioInput {
  title: string;
  description: string;
  tradeCode: string | null;
  projectLabel: string;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  completedOn: string | null;
  visibility: ProfileVisibility;
  sortOrder: number;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || fallback);
  return body;
}

async function jsonRequest<T>(path: string, init?: RequestInit, fallback = "Professional profile could not be updated.") {
  const response = await fetchWithTimeout(apiPath(path), {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.method === "POST" && !path.endsWith("/restore") ? { "Idempotency-Key": requestKey() } : {}),
      ...init?.headers,
    },
  });
  return readJson<T>(response, fallback);
}

export async function fetchOwnProfessionalProfile() {
  const body = await jsonRequest<{ data?: { professionalProfile?: OwnProfessionalProfile } }>(
    "/api/v1/profile/professional",
    undefined,
    "Professional profile could not be loaded.",
  );
  if (!body.data?.professionalProfile) throw new Error("Professional profile response was incomplete.");
  return body.data.professionalProfile;
}

export async function fetchNetworkProfessionalProfile(accountId: string) {
  const body = await jsonRequest<{ data?: { profile?: NetworkProfessionalProfile } }>(
    `/api/v1/profiles/${encodeURIComponent(accountId)}`,
    undefined,
    "Published profile could not be loaded.",
  );
  if (!body.data?.profile) throw new Error("Published profile response was incomplete.");
  return body.data.profile;
}

export async function createCredential(input: CredentialInput) {
  await jsonRequest("/api/v1/profile/credentials", {
    method: "POST",
    body: JSON.stringify(input),
  }, "Credential could not be saved.");
}

export async function updateCredential(credential: ProfileCredential, input: CredentialInput) {
  await jsonRequest(`/api/v1/profile/credentials/${encodeURIComponent(credential.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, expectedVersion: credential.version }),
  }, "Credential could not be updated.");
}

export async function archiveCredential(credential: ProfileCredential) {
  await jsonRequest(`/api/v1/profile/credentials/${encodeURIComponent(credential.id)}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion: credential.version }),
  }, "Credential could not be archived.");
}

export async function restoreCredential(credential: ProfileCredential) {
  await jsonRequest(`/api/v1/profile/credentials/${encodeURIComponent(credential.id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: credential.version }),
  }, "Credential could not be restored.");
}

export async function uploadCredentialEvidence(credential: ProfileCredential, file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("expectedVersion", String(credential.version));
  const response = await fetchWithTimeout(apiPath(`/api/v1/profile/credentials/${encodeURIComponent(credential.id)}/evidence`), {
    method: "POST",
    credentials: "include",
    body: form,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  await readJson(response, "Credential evidence could not be uploaded.");
}

export async function removeCredentialEvidence(credential: ProfileCredential) {
  await jsonRequest(`/api/v1/profile/credentials/${encodeURIComponent(credential.id)}/evidence`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion: credential.version }),
  }, "Credential evidence could not be removed.");
}

export async function createAvailabilityWindow(input: AvailabilityWindowInput) {
  await jsonRequest("/api/v1/profile/availability-windows", {
    method: "POST",
    body: JSON.stringify(input),
  }, "Availability window could not be saved.");
}

export async function updateAvailabilityWindow(window: ProfileAvailabilityWindow, input: AvailabilityWindowInput) {
  await jsonRequest(`/api/v1/profile/availability-windows/${encodeURIComponent(window.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, expectedVersion: window.version }),
  }, "Availability window could not be updated.");
}

export async function archiveAvailabilityWindow(window: ProfileAvailabilityWindow) {
  await jsonRequest(`/api/v1/profile/availability-windows/${encodeURIComponent(window.id)}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion: window.version }),
  }, "Availability window could not be archived.");
}

export async function restoreAvailabilityWindow(window: ProfileAvailabilityWindow) {
  await jsonRequest(`/api/v1/profile/availability-windows/${encodeURIComponent(window.id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: window.version }),
  }, "Availability window could not be restored.");
}

export async function createPortfolioItem(input: PortfolioInput, file: File) {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(input)) {
    if (value !== null) form.append(key, String(value));
  }
  const response = await fetchWithTimeout(apiPath("/api/v1/profile/portfolio"), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": requestKey() },
    body: form,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  await readJson(response, "Portfolio item could not be uploaded.");
}

export async function updatePortfolioItem(item: ProfilePortfolioItem, input: PortfolioInput) {
  await jsonRequest(`/api/v1/profile/portfolio/${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, expectedVersion: item.version }),
  }, "Portfolio item could not be updated.");
}

export async function archivePortfolioItem(item: ProfilePortfolioItem) {
  await jsonRequest(`/api/v1/profile/portfolio/${encodeURIComponent(item.id)}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion: item.version }),
  }, "Portfolio item could not be archived.");
}

export async function restorePortfolioItem(item: ProfilePortfolioItem) {
  await jsonRequest(`/api/v1/profile/portfolio/${encodeURIComponent(item.id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: item.version }),
  }, "Portfolio item could not be restored.");
}

export async function uploadProfileAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetchWithTimeout(apiPath("/api/v1/profile/avatar"), {
    method: "POST",
    credentials: "include",
    body: form,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  await readJson(response, "Profile photo could not be uploaded.");
}

export async function removeProfileAvatar() {
  await jsonRequest("/api/v1/profile/avatar", { method: "DELETE" }, "Profile photo could not be removed.");
}
