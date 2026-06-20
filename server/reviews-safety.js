import { ApiError, z } from "./api.js";

const adminReason = {
  reasonCode: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(1).max(2000),
};

export const reviewSubmitSchema = z.object({
  revieweeAccountId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
  consentAccepted: z.literal(true),
  consentVersion: z.string().trim().min(1).max(80),
});

export const reviewDisputeSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const reviewResponseSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

export const adminReviewResolveSchema = z.object({
  status: z.enum(["resolved", "hidden"]),
  ...adminReason,
});

export const safetyReportSchema = z.object({
  subjectType: z.enum(["account", "job", "conversation", "message", "active_work", "project"]),
  subjectId: z.string().trim().min(1).max(120),
  reportedAccountId: z.uuid().nullable().default(null),
  reason: z.enum(["spam", "harassment", "suspicious", "inappropriate", "safety", "payment", "other"]),
  note: z.string().trim().max(2000).default(""),
});

export const unsafeWorkReportSchema = z.object({
  conditionType: z.enum(["unsafe_condition", "stop_work", "near_miss", "site_access", "other"]).default("stop_work"),
  severity: z.enum(["needs_review", "urgent", "resolved"]).default("needs_review"),
  description: z.string().trim().min(1).max(2000),
  consentAccepted: z.literal(true).optional(),
  consentVersion: z.string().trim().min(1).max(80).optional(),
});

export const supportCaseCreateSchema = z.object({
  subjectAccountId: z.uuid().nullable().default(null),
  activeWorkId: z.uuid().nullable().default(null),
  projectId: z.uuid().nullable().default(null),
  category: z.enum(["appeal", "unsafe_condition", "account", "review", "payment", "technical", "other"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
});

export const supportCaseEventSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

export const adminSupportCaseEventSchema = z.object({
  eventType: z.enum(["internal_note", "status_changed"]),
  status: z.enum(["open", "reviewing", "resolved", "closed"]).optional(),
  visibility: z.enum(["user", "internal"]).default("internal"),
  note: z.string().trim().min(1).max(4000),
  ...adminReason,
});

export const restrictionCreateSchema = z.object({
  restrictionType: z.enum(["warning", "mutation_restricted", "timeout_24h", "suspension", "ban"]),
  endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  ...adminReason,
});

export const restrictionLiftSchema = z.object({
  ...adminReason,
});

export function requireAdminRole(admin, allowedRoles = ["owner", "support", "moderator"]) {
  const match = admin.roles.find((role) => allowedRoles.includes(role));
  if (!match) {
    throw new ApiError(403, "ADMIN_ACCESS_DENIED", "This route requires RIVT staff access.");
  }
  return match;
}

export function mapReview(row, { events = [] } = {}) {
  return {
    id: row.id,
    activeWorkId: row.active_work_id,
    projectId: row.project_id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    reviewerAccountId: row.reviewer_account_id,
    revieweeAccountId: row.reviewee_account_id,
    reviewerRole: row.reviewer_role,
    rating: Number(row.rating),
    body: row.body,
    status: row.status,
    submittedAt: isoDateTime(row.submitted_at),
    approvedAt: isoDateTime(row.approved_at),
    disputedAt: isoDateTime(row.disputed_at),
    resolvedAt: isoDateTime(row.resolved_at),
    updatedAt: isoDateTime(row.updated_at),
    job: row.job_title ? {
      id: row.job_id,
      title: row.job_title,
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
      },
    } : undefined,
    reviewer: profileFromRow(row, "reviewer") ?? undefined,
    reviewee: profileFromRow(row, "reviewee") ?? undefined,
    events: events.map(mapReviewEvent),
  };
}

export function mapReviewEvent(row) {
  return {
    id: row.id,
    reviewId: row.review_id,
    actorAccountId: row.actor_account_id,
    type: row.event_type,
    note: row.note || "",
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

export function mapReputation(row) {
  return {
    accountId: row.account_id,
    displayName: row.display_name || "",
    headline: row.headline || "",
    location: [row.service_area_city, row.service_area_region].filter(Boolean).join(", "),
    reviews: {
      publishedCount: Number(row.published_count ?? 0),
      averageRating: row.average_rating === null ? null : Number(row.average_rating),
      pendingCount: Number(row.pending_count ?? 0),
      disputedCount: Number(row.disputed_count ?? 0),
    },
  };
}

export function mapSafetyReport(row) {
  return {
    id: row.id,
    reporterAccountId: row.reporter_account_id,
    reportedAccountId: row.reported_account_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    note: row.note || "",
    status: row.status,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

export function mapUnsafeWorkReport(row, { events = [] } = {}) {
  return {
    id: row.id,
    activeWorkId: row.active_work_id,
    projectId: row.project_id,
    reporterAccountId: row.reporter_account_id,
    conditionType: row.condition_type,
    severity: row.severity,
    description: row.description,
    status: row.status,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    events: events.map(mapUnsafeWorkReportEvent),
  };
}

export function mapUnsafeWorkReportEvent(row) {
  return {
    id: row.id,
    unsafeReportId: row.unsafe_report_id,
    actorAccountId: row.actor_account_id,
    type: row.event_type,
    note: row.note || "",
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

export function mapSupportCase(row, { events = [] } = {}) {
  return {
    id: row.id,
    openedByAccountId: row.opened_by_account_id,
    subjectAccountId: row.subject_account_id,
    activeWorkId: row.active_work_id,
    projectId: row.project_id,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    events: events.map(mapSupportCaseEvent),
  };
}

export function mapSupportCaseEvent(row) {
  return {
    id: row.id,
    supportCaseId: row.support_case_id,
    actorAccountId: row.actor_account_id,
    type: row.event_type,
    visibility: row.visibility,
    note: row.note || "",
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

export function mapRestriction(row, { events = [] } = {}) {
  return {
    id: row.id,
    accountId: row.account_id,
    imposedByAccountId: row.imposed_by_account_id,
    type: row.restriction_type,
    status: row.status,
    reasonCode: row.reason_code,
    reason: row.reason,
    startsAt: isoDateTime(row.starts_at),
    endsAt: isoDateTime(row.ends_at),
    liftedAt: isoDateTime(row.lifted_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    events: events.map(mapRestrictionEvent),
  };
}

export function mapRestrictionEvent(row) {
  return {
    id: row.id,
    restrictionId: row.restriction_id,
    actorAccountId: row.actor_account_id,
    type: row.event_type,
    reasonCode: row.reason_code,
    reason: row.reason || "",
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

export function mapAdminAction(row) {
  return {
    id: row.id,
    actorAccountId: row.actor_account_id,
    action: row.action,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reasonCode: row.reason_code,
    reason: row.reason,
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

function profileFromRow(row, prefix) {
  const accountId = row[`${prefix}_account_id`];
  if (!accountId) return null;
  return {
    accountId,
    displayName: row[`${prefix}_display_name`] || "",
    headline: row[`${prefix}_headline`] || "",
    serviceArea: {
      city: row[`${prefix}_service_area_city`] || "",
      region: row[`${prefix}_service_area_region`] || "",
    },
  };
}

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}
