import { apiPath, fetchWithTimeout } from "../../lib/api";
import type { ShopTalkReportReason } from "../shop-talk/shop-talk-api";

export type ModerationReportStatus = "open" | "reviewing" | "actioned" | "dismissed" | "all";
export type ModerationTargetType = "community" | "post" | "answer";
export type ModerationAction = "dismiss" | "hide" | "lock" | "archive_community" | "restore";

export interface ModerationTargetSnapshot {
  slug?: string;
  name?: string;
  description?: string;
  title?: string;
  bodyExcerpt?: string;
  authorName?: string;
  communityName?: string;
  communitySlug?: string;
  postTitle?: string;
  verifiedFix?: boolean;
  moderationStatus?: string;
  archivedAt?: string | null;
}

export interface ModerationReport {
  id: string;
  reporterAccountId: string;
  reporterName: string;
  targetType: ModerationTargetType;
  targetId: string;
  reasonCode: ShopTalkReportReason;
  note: string;
  targetSnapshot: ModerationTargetSnapshot;
  status: Exclude<ModerationReportStatus, "all">;
  reviewedByAccountId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchShopTalkModerationReports(status: ModerationReportStatus): Promise<ModerationReport[]> {
  const response = await fetchWithTimeout(
    apiPath(`/api/v1/admin/shop-talk/reports?status=${encodeURIComponent(status)}`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`Could not load moderation reports (${response.status}).`);
  }
  const body = await response.json().catch(() => null) as { data?: { reports?: ModerationReport[] } } | null;
  return Array.isArray(body?.data?.reports) ? body.data.reports : [];
}

export async function resolveShopTalkModerationReport(
  reportId: string,
  input: { action: ModerationAction; reasonCode: string; reason: string },
): Promise<ModerationReport> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/admin/shop-talk/reports/${encodeURIComponent(reportId)}/actions`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Could not apply moderation action (${response.status}).`);
  }
  const body = await response.json().catch(() => null) as { data?: { report?: ModerationReport } } | null;
  if (!body?.data?.report) {
    throw new Error("Moderation action completed without a report payload.");
  }
  return body.data.report;
}
