import { makeRequest, requestKey, RivtApiError, type ApiErrorBody } from "../../lib/api";

export interface StandaloneProject {
  id: string;
  accountId: string;
  title: string;
  clientName: string;
  locationText: string;
  tradeCode: string;
  status: "active" | "archived";
  photoCount: number;
  albumId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export class StandaloneProjectApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the standalone-project request.");
    this.name = "StandaloneProjectApiError";
  }
}

const request = makeRequest((status, body) => new StandaloneProjectApiError(status, body));

export async function listStandaloneProjects() {
  const body = await request<{ data: { projects: StandaloneProject[] } }>("/api/v1/standalone-projects");
  return body.data.projects;
}

export async function createStandaloneProject(input: {
  title: string;
  clientName?: string;
  locationText?: string;
  tradeCode?: string;
}) {
  const body = await request<{ data: { project: StandaloneProject } }>("/api/v1/standalone-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify(input),
  });
  return body.data.project;
}
