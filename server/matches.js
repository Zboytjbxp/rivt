import { ApiError, z } from "./api.js";

const note = z.string().trim().max(1200).default("");
const consentVersion = z.string().trim().min(1).max(80);

export const applicationDraftSchema = z.object({
  message: note,
  proposedStartDate: z.iso.date().nullable().default(null),
});

export const applicationSubmitSchema = applicationDraftSchema.extend({
  consentAccepted: z.literal(true),
  consentVersion,
});

export const applicationDecisionSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});

export const offerCreateSchema = z.object({
  startDate: z.iso.date().nullable().default(null),
  scopeSummary: z.string().trim().max(2000).default(""),
  message: note,
  expiresAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export const offerDecisionSchema = z.object({
  reason: z.string().trim().max(500).default(""),
  consentAccepted: z.literal(true).optional(),
  consentVersion: consentVersion.optional(),
});

export const workTransitionSchema = z.object({
  reason: z.string().trim().min(1).max(800),
});

export function requireTradespersonActor(actor) {
  if (actor.account.status !== "active" || actor.profile.onboardingStatus !== "complete") {
    throw new ApiError(403, "ACCOUNT_NOT_READY", "Complete account setup before applying for work.");
  }
  if (actor.account.primaryRole !== "tradesperson") {
    throw new ApiError(403, "TRADESPERSON_REQUIRED", "Only tradesperson accounts can apply for work.");
  }
}

export function requireOfferAcceptanceConsent(input, expectedConsentVersion) {
  if (input.consentAccepted !== true || input.consentVersion !== expectedConsentVersion) {
    throw new ApiError(409, "CONSENT_REQUIRED", "Review and accept the current work agreement before accepting this offer.", {
      consentVersion: expectedConsentVersion,
    });
  }
}

function isoDate(value) {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
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

export function mapApplication(row, { events = [] } = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    applicantAccountId: row.applicant_account_id,
    status: row.status,
    message: row.message || "",
    proposedStartDate: isoDate(row.proposed_start_date),
    submittedAt: isoDateTime(row.submitted_at),
    withdrawnAt: isoDateTime(row.withdrawn_at),
    decidedAt: isoDateTime(row.decided_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    job: row.job_title ? {
      id: row.job_id,
      title: row.job_title,
      status: row.job_status,
      organization: { id: row.organization_id, name: row.organization_name },
      trade: row.job_trade_code ? {
        code: row.job_trade_code,
        name: row.job_trade_name || row.job_trade_code,
      } : undefined,
      durationHours: row.job_duration_hours === null || row.job_duration_hours === undefined
        ? null
        : Number(row.job_duration_hours),
      budget: row.job_budget_cents === null || row.job_budget_cents === undefined
        ? null
        : {
            amountCents: Number(row.job_budget_cents),
            currency: "USD",
            unit: row.job_budget_unit || "fixed",
          },
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
        countryCode: row.public_country_code,
      },
    } : undefined,
    applicant: profileFromRow(row, "applicant") ?? undefined,
    events: events.map(mapTimelineEvent),
  };
}

export function mapOffer(row, { events = [] } = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    applicationId: row.application_id,
    contractorAccountId: row.contractor_account_id,
    recipientAccountId: row.recipient_account_id,
    status: row.status,
    startDate: isoDate(row.start_date),
    scopeSummary: row.scope_summary || "",
    message: row.message || "",
    expiresAt: isoDateTime(row.expires_at),
    acceptedAt: isoDateTime(row.accepted_at),
    declinedAt: isoDateTime(row.declined_at),
    cancelledAt: isoDateTime(row.cancelled_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    job: row.job_title ? {
      id: row.job_id,
      title: row.job_title,
      status: row.job_status,
      organization: { id: row.organization_id, name: row.organization_name },
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
        countryCode: row.public_country_code,
      },
    } : undefined,
    recipient: profileFromRow(row, "recipient") ?? undefined,
    events: events.map(mapTimelineEvent),
  };
}

export function mapActiveWork(row, { events = [] } = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    offerId: row.offer_id,
    organizationId: row.organization_id,
    contractorAccountId: row.contractor_account_id,
    tradespersonAccountId: row.tradesperson_account_id,
    status: row.status,
    startedAt: isoDateTime(row.started_at),
    completedAt: isoDateTime(row.completed_at),
    cancelledAt: isoDateTime(row.cancelled_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    job: row.job_title ? {
      id: row.job_id,
      title: row.job_title,
      status: row.job_status,
      organization: { id: row.organization_id, name: row.organization_name },
      trade: row.job_trade_code ? {
        code: row.job_trade_code,
        name: row.job_trade_name || row.job_trade_code,
      } : undefined,
      durationHours: row.job_duration_hours == null ? null : Number(row.job_duration_hours),
      budget: {
        amountCents: Number(row.job_budget_cents ?? 0),
        unit: row.job_budget_unit || "fixed",
      },
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
        countryCode: row.public_country_code,
      },
    } : undefined,
    events: events.map(mapTimelineEvent),
  };
}

function mapTimelineEvent(row) {
  return {
    id: row.id,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason || "",
    occurredAt: isoDateTime(row.occurred_at),
  };
}
