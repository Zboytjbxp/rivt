import type { Job } from "../../types";
import type { CanonicalActiveWork } from "../work/job-api";
import type { StandaloneProject } from "./standalone-project-api";

export type ToolWorkContext =
  | { kind: "quick" }
  | { kind: "standalone"; project: StandaloneProject }
  | { kind: "rivt"; activeWorkId: string; work: CanonicalActiveWork; job: Job | null };

function normalizedStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function isSelectableActiveWork(work: CanonicalActiveWork) {
  return normalizedStatus(work.status) === "active";
}

export function toolContextLabel(context: ToolWorkContext) {
  if (context.kind === "rivt") return context.work.job?.title ?? context.job?.title ?? "RIVT workspace";
  if (context.kind === "standalone") return context.project.title;
  return "Quick use";
}

export function toolContextEyebrow(context: ToolWorkContext) {
  if (context.kind === "rivt") return "RIVT workspace";
  if (context.kind === "standalone") return "Standalone project";
  return "Not linked";
}

export function toolContextRecordFields(context: ToolWorkContext) {
  return {
    standaloneProjectId: context.kind === "standalone" ? context.project.id : null,
    activeWorkId: context.kind === "rivt" ? context.activeWorkId : null,
  };
}

export function toolContextStorageId(context: ToolWorkContext) {
  if (context.kind === "rivt") return `rivt:${context.activeWorkId}`;
  if (context.kind === "standalone") return `standalone:${context.project.id}`;
  return "quick";
}
