import { ApiError, paginationQuerySchema, z } from "./api.js";

const difficultyValues = ["easy", "moderate", "challenging", "advanced", "expert"];
const workTypeValues = ["side_work", "emergency", "multi_day", "inspection_prep"];
const statusValues = ["draft", "open", "paused", "closed"];

const textList = z.array(z.string().trim().min(1).max(160)).max(30).default([])
  .transform((items) => [...new Set(items)]);

export const publicLocationSchema = z.object({
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("US"),
  postalPrefix: z.string().trim().max(12).nullable().optional(),
});

export const privateLocationSchema = z.object({
  addressLine1: z.string().trim().max(180).default(""),
  addressLine2: z.string().trim().max(180).default(""),
  city: z.string().trim().max(100).default(""),
  region: z.string().trim().max(100).default(""),
  postalCode: z.string().trim().max(20).default(""),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("US"),
  accessNotes: z.string().trim().max(1200).default(""),
});

const editableJobFields = {
  title: z.string().trim().min(4).max(140),
  tradeCode: z.string().trim().min(1).max(80),
  summary: z.string().trim().max(500).default(""),
  scopeDescription: z.string().trim().max(5000).default(""),
  difficulty: z.enum(difficultyValues).default("moderate"),
  workType: z.enum(workTypeValues).default("side_work"),
  budgetCents: z.number().int().min(5000).max(100000000).nullable().default(null),
  budgetUnit: z.enum(["fixed", "hourly"]).default("fixed"),
  durationHours: z.number().positive().max(10000).nullable().default(null),
  preferredStartDate: z.iso.date().nullable().default(null),
  applicationDeadline: z.iso.datetime({ offset: true }).nullable().default(null),
  insuranceRequired: z.boolean().default(false),
  tools: textList,
  materials: textList,
  deliverables: textList,
  certificationCodes: textList,
  publicLocation: publicLocationSchema,
  privateLocation: privateLocationSchema.nullable().default(null),
};

export const createJobSchema = z.object({
  organizationId: z.uuid(),
  ...editableJobFields,
});

export const updateJobSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: editableJobFields.title.optional(),
  tradeCode: editableJobFields.tradeCode.optional(),
  summary: editableJobFields.summary.optional(),
  scopeDescription: editableJobFields.scopeDescription.optional(),
  difficulty: editableJobFields.difficulty.optional(),
  workType: editableJobFields.workType.optional(),
  budgetCents: editableJobFields.budgetCents.optional(),
  budgetUnit: editableJobFields.budgetUnit.optional(),
  durationHours: editableJobFields.durationHours.optional(),
  preferredStartDate: editableJobFields.preferredStartDate.optional(),
  applicationDeadline: editableJobFields.applicationDeadline.optional(),
  insuranceRequired: editableJobFields.insuranceRequired.optional(),
  tools: textList.optional(),
  materials: textList.optional(),
  deliverables: textList.optional(),
  certificationCodes: textList.optional(),
  publicLocation: publicLocationSchema.optional(),
  privateLocation: privateLocationSchema.nullable().optional(),
});

export const publishJobSchema = z.object({
  expectedVersion: z.number().int().positive(),
  consentAccepted: z.literal(true),
  consentVersion: z.string().trim().min(1).max(80),
});

export const transitionJobSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(500).default(""),
});

export const jobListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  trade: z.string().trim().max(80).optional(),
  difficulty: z.enum(difficultyValues).optional(),
  workType: z.enum(workTypeValues).optional(),
  status: z.enum(statusValues).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  insuranceRequired: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export function assertPublishableJob(job) {
  const missing = [];
  if (!job.title?.trim()) missing.push("title");
  if (!job.trade_code) missing.push("tradeCode");
  if ((job.summary?.trim().length ?? 0) < 20) missing.push("summary");
  if ((job.scope_description?.trim().length ?? 0) < 20) missing.push("scopeDescription");
  if (!job.budget_cents) missing.push("budgetCents");
  if (!job.duration_hours) missing.push("durationHours");
  if (!job.public_city || !job.public_region) missing.push("publicLocation");
  if (!job.address_line1 || !job.private_city || !job.private_region || !job.postal_code) missing.push("privateLocation");
  if (job.application_deadline && new Date(job.application_deadline).getTime() <= Date.now()) missing.push("applicationDeadline");
  if (missing.length) {
    throw new ApiError(422, "JOB_NOT_READY", "Complete the required job details before publishing.", { missing });
  }
}

export function transitionFor(status, action) {
  const transitions = {
    publish: { draft: "open" },
    pause: { open: "paused" },
    resume: { paused: "open" },
    close: { open: "closed", paused: "closed", draft: "closed" },
  };
  const next = transitions[action]?.[status];
  if (!next) {
    throw new ApiError(409, "JOB_TRANSITION_INVALID", `A ${status} job cannot be ${action}d.`);
  }
  return next;
}

export function requirementsByKind(rows = []) {
  const result = { tools: [], materials: [], deliverables: [], certificationCodes: [] };
  const targetByKind = {
    tool: "tools",
    material: "materials",
    deliverable: "deliverables",
    certification: "certificationCodes",
  };
  for (const row of rows) {
    const target = targetByKind[row.kind];
    if (target) result[target].push(row.value);
  }
  return result;
}

function isoDate(value) {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

export function calculateMatchScore(job, actor) {
  if (!actor || actor.account.primaryRole !== "tradesperson") return null;
  const tradeCodes = new Set(actor.profile.trades.map((trade) => trade.code));
  let score = tradeCodes.has(job.trade_code) ? 60 : 0;
  if (actor.profile.serviceArea.region.toLowerCase() === String(job.public_region).toLowerCase()) score += 25;
  if (actor.profile.serviceArea.city.toLowerCase() === String(job.public_city).toLowerCase()) score += 15;
  return Math.min(score, 100);
}

export function mapJobRecord(row, { includePrivateLocation = false, actor = null, requirements = [], events = [] } = {}) {
  const job = {
    id: row.id,
    organization: { id: row.organization_id, name: row.organization_name },
    createdByAccountId: row.created_by_account_id,
    title: row.title,
    trade: { code: row.trade_code, name: row.trade_name },
    summary: row.summary,
    scopeDescription: row.scope_description,
    status: row.status,
    difficulty: row.difficulty,
    workType: row.work_type,
    budget: row.budget_cents === null ? null : {
      amountCents: row.budget_cents,
      currency: "USD",
      unit: row.budget_unit,
    },
    durationHours: row.duration_hours === null ? null : Number(row.duration_hours),
    preferredStartDate: isoDate(row.preferred_start_date),
    applicationDeadline: isoDateTime(row.application_deadline),
    insuranceRequired: row.insurance_required,
    publicLocation: {
      city: row.public_city,
      region: row.public_region,
      countryCode: row.public_country_code,
      postalPrefix: row.postal_prefix,
    },
    requirements: requirementsByKind(requirements),
    addressPrivacy: "Exact address is shared only after an accepted work relationship.",
    matchScore: calculateMatchScore(row, actor),
    version: row.version,
    publishedAt: isoDateTime(row.published_at),
    pausedAt: isoDateTime(row.paused_at),
    closedAt: isoDateTime(row.closed_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    events: events.map((event) => ({
      id: event.id,
      type: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      reason: event.reason,
      occurredAt: isoDateTime(event.occurred_at),
    })),
  };

  if (includePrivateLocation) {
    job.privateLocation = {
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.private_city,
      region: row.private_region,
      postalCode: row.postal_code,
      countryCode: row.private_country_code,
      accessNotes: row.access_notes,
    };
  }
  return job;
}

export function jobSelectSql({ includePrivateLocation = false } = {}) {
  return `
    SELECT j.*, o.name AS organization_name, t.name AS trade_name,
           pl.city AS public_city, pl.region AS public_region,
           pl.country_code AS public_country_code, pl.postal_prefix
           ${includePrivateLocation ? `,
           private.address_line1, private.address_line2,
           private.city AS private_city, private.region AS private_region,
           private.postal_code, private.country_code AS private_country_code,
           private.access_notes` : ""}
    FROM jobs j
    INNER JOIN organizations o ON o.id = j.organization_id
    INNER JOIN trades t ON t.code = j.trade_code
    INNER JOIN job_public_locations pl ON pl.job_id = j.id
    ${includePrivateLocation ? "LEFT JOIN job_private_locations private ON private.job_id = j.id" : ""}
  `;
}

export { difficultyValues, statusValues, workTypeValues };
