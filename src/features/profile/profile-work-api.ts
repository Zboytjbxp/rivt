import { type ApiErrorBody, RivtApiError, makeRequest, requestKey } from "../../lib/api";

export class ProfileWorkApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the featured work request.");
    this.name = "ProfileWorkApiError";
  }
}

export interface ProfileWorkSample {
  id: string;
  albumPhotoId: string;
  title: string;
  caption: string;
  sortOrder: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  signedUrl: string | null;
}

const request = makeRequest((status, body) => new ProfileWorkApiError(status, body));

function readSamples(body: { data?: { samples?: ProfileWorkSample[] } }): ProfileWorkSample[] {
  return Array.isArray(body.data?.samples) ? body.data.samples : [];
}

export async function fetchOwnWorkSamples() {
  const body = await request<{ data?: { samples?: ProfileWorkSample[] } }>("/api/v1/profile/work-samples");
  return readSamples(body);
}

export async function fetchProfileWorkSamples(accountId: string) {
  const body = await request<{ data?: { samples?: ProfileWorkSample[] } }>(
    `/api/v1/profiles/${encodeURIComponent(accountId)}/work-samples`,
  );
  return readSamples(body);
}

export async function featureWorkSample(albumPhotoId: string) {
  const body = await request<{ data?: { samples?: ProfileWorkSample[] } }>("/api/v1/profile/work-samples", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ albumPhotoId }),
  });
  return readSamples(body);
}

export async function removeWorkSample(sampleId: string) {
  const body = await request<{ data?: { samples?: ProfileWorkSample[] } }>(
    `/api/v1/profile/work-samples/${encodeURIComponent(sampleId)}`,
    { method: "DELETE", headers: { "Idempotency-Key": requestKey() } },
  );
  return readSamples(body);
}
