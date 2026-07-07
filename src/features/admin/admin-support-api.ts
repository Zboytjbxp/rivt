import { apiPath, requestKey } from "../../lib/api";
import type { Role } from "../../types";

export type SupportCaseStatus = "open" | "reviewing" | "resolved" | "closed";

export interface SupportCaseActor {
  accountId: string;
  email: string;
  displayName: string;
  primaryRole: Role | "pending" | "";
  status: string;
}

export interface SupportCaseEvent {
  id: string;
  supportCaseId: string;
  actorAccountId: string;
  type: "opened" | "user_note" | "internal_note" | "status_changed";
  visibility: "user" | "internal";
  note: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface SupportCase {
  id: string;
  openedByAccountId: string;
  openedBy: SupportCaseActor | null;
  subjectAccountId: string | null;
  activeWorkId: string | null;
  projectId: string | null;
  category: "appeal" | "unsafe_condition" | "account" | "review" | "payment" | "technical" | "other";
  title: string;
  description: string;
  status: SupportCaseStatus;
  createdAt: string;
  updatedAt: string;
  events: SupportCaseEvent[];
}

export async function fetchAdminSupportCases(): Promise<SupportCase[]> {
  const response = await fetch(apiPath("/api/v1/admin/overview"), { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Could not load support cases (${response.status}).`);
  }
  const body = await response.json().catch(() => null) as { data?: { supportCases?: SupportCase[] } } | null;
  return Array.isArray(body?.data?.supportCases) ? body.data.supportCases : [];
}

export async function approveAccountTypeChange(
  supportCaseId: string,
  input: { targetRole: Role; organizationName?: string; reasonCode: string; reason: string },
): Promise<SupportCase> {
  const response = await fetch(apiPath(`/api/v1/admin/support-cases/${encodeURIComponent(supportCaseId)}/account-type`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as { data?: { case?: SupportCase }; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `Could not approve account type change (${response.status}).`);
  }
  if (!body?.data?.case) {
    throw new Error("Account type change completed without a support case payload.");
  }
  return body.data.case;
}

export async function updateSupportCaseStatus(
  supportCaseId: string,
  input: { status: SupportCaseStatus; note: string; reasonCode: string; reason: string },
): Promise<SupportCase> {
  const response = await fetch(apiPath(`/api/v1/admin/support-cases/${encodeURIComponent(supportCaseId)}/events`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify({
      eventType: "status_changed",
      visibility: "user",
      ...input,
    }),
  });
  const body = await response.json().catch(() => null) as { data?: { case?: SupportCase }; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `Could not update support case (${response.status}).`);
  }
  if (!body?.data?.case) {
    throw new Error("Support case update completed without a support case payload.");
  }
  return body.data.case;
}
