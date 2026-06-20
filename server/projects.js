import { z } from "./api.js";

export const projectEntryCreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  checklist: z.record(z.string(), z.union([z.boolean(), z.string().trim().max(240)])).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const completionSubmitSchema = z.object({
  note: z.string().trim().min(1).max(4000),
  checklist: z.object({
    completedOnTime: z.boolean().default(false),
    clientApproved: z.boolean().default(false),
    photosProvided: z.boolean().default(false),
  }).default({ completedOnTime: false, clientApproved: false, photosProvided: false }),
  evidenceMediaIds: z.array(z.uuid()).max(20).default([]),
});

export const completionResolutionSchema = z.object({
  reason: z.string().trim().max(1000).default(""),
});

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

export function mediaKindForMime(mimeType) {
  if (String(mimeType ?? "").startsWith("image/")) return "photo";
  if (mimeType === "application/pdf" || mimeType === "text/plain") return "document";
  return "other";
}

export function detectUploadContent(file) {
  const buffer = file?.buffer;
  const mimeType = file?.mimetype ?? "";
  if (!buffer || !buffer.length) {
    return { ok: false, code: "UPLOAD_EMPTY", message: "The uploaded file is empty." };
  }

  const startsWith = (bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const hasTextOnly = () => {
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    return [...sample].every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126));
  };

  const signatures = {
    "application/pdf": () => startsWith([0x25, 0x50, 0x44, 0x46]),
    "image/gif": () => startsWith([0x47, 0x49, 0x46, 0x38]),
    "image/jpeg": () => startsWith([0xff, 0xd8, 0xff]),
    "image/png": () => startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "image/webp": () => startsWith([0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString("ascii") === "WEBP",
    "text/plain": hasTextOnly,
  };

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const brand = buffer.subarray(4, 12).toString("ascii");
    const ok = brand.startsWith("ftyp") && /hei[cfx]|mif1|msf1/i.test(buffer.subarray(8, 32).toString("ascii"));
    return ok
      ? { ok: true, reviewStatus: "not_scanned" }
      : { ok: false, code: "UPLOAD_SIGNATURE_MISMATCH", message: "The file content does not match the declared type." };
  }

  const matches = signatures[mimeType]?.();
  if (!matches) {
    return { ok: false, code: "UPLOAD_SIGNATURE_MISMATCH", message: "The file content does not match the declared type." };
  }
  return { ok: true, reviewStatus: "not_scanned" };
}

export function mapProject(row, { entries = [], media = [], submissions = [] } = {}) {
  return {
    id: row.id,
    activeWorkId: row.active_work_id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    status: row.status,
    createdByAccountId: row.created_by_account_id,
    contractorAccountId: row.contractor_account_id,
    tradespersonAccountId: row.tradesperson_account_id,
    completionSubmittedAt: isoDateTime(row.completion_submitted_at),
    confirmedAt: isoDateTime(row.confirmed_at),
    disputedAt: isoDateTime(row.disputed_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    job: {
      title: row.job_title,
      status: row.job_status,
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
        countryCode: row.public_country_code,
      },
    },
    entries: entries.map(mapProjectEntry),
    media: media.map(mapProjectMedia),
    completionSubmissions: submissions.map((submission) => mapCompletionSubmission(submission, {
      resolutions: submission.resolutions ?? [],
    })),
  };
}

export function mapProjectEntry(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    activeWorkId: row.active_work_id,
    actorAccountId: row.actor_account_id,
    entryType: row.entry_type,
    body: row.body || "",
    checklist: row.checklist ?? {},
    metadata: row.metadata ?? {},
    createdAt: isoDateTime(row.created_at),
  };
}

export function mapProjectMedia(row, { signedUrl = null } = {}) {
  return {
    id: row.id,
    projectId: row.project_id,
    entryId: row.entry_id,
    uploadId: row.upload_id,
    uploaderAccountId: row.uploader_account_id,
    originalName: row.original_name || "",
    mimeType: row.mime_type || "",
    sizeBytes: Number(row.size_bytes ?? 0),
    contentSha256: row.content_sha256,
    mediaKind: row.media_kind,
    status: row.status,
    reviewStatus: row.review_status,
    failureReason: row.failure_reason || "",
    createdAt: isoDateTime(row.created_at),
    signedUrl,
  };
}

export function mapCompletionSubmission(row, { resolutions = [] } = {}) {
  return {
    id: row.id,
    projectId: row.project_id,
    submittedByAccountId: row.submitted_by_account_id,
    note: row.note,
    checklist: row.checklist ?? {},
    evidenceMediaIds: row.evidence_media_ids ?? [],
    status: row.status,
    submittedAt: isoDateTime(row.submitted_at),
    resolvedAt: isoDateTime(row.resolved_at),
    resolutions: resolutions.map(mapCompletionResolution),
  };
}

export function mapCompletionResolution(row) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    projectId: row.project_id,
    actorAccountId: row.actor_account_id,
    decision: row.decision,
    reason: row.reason || "",
    createdAt: isoDateTime(row.created_at),
  };
}

export function buildCloseoutReport(project, entries, media, submissions, resolutions) {
  return {
    reportVersion: "gate-a-project-closeout-v1",
    projectId: project.id,
    activeWorkId: project.active_work_id,
    jobId: project.job_id,
    status: project.status,
    job: {
      title: project.job_title,
      publicLocation: `${project.public_city}, ${project.public_region}`,
    },
    parties: {
      contractorAccountId: project.contractor_account_id,
      tradespersonAccountId: project.tradesperson_account_id,
    },
    timeline: entries.map((entry) => ({
      id: entry.id,
      type: entry.entry_type,
      actorAccountId: entry.actor_account_id,
      body: entry.body || "",
      checklist: entry.checklist ?? {},
      metadata: entry.metadata ?? {},
      createdAt: isoDateTime(entry.created_at),
    })),
    evidence: media.map((item) => ({
      id: item.id,
      uploadId: item.upload_id,
      originalName: item.original_name || "",
      mimeType: item.mime_type || "",
      sizeBytes: Number(item.size_bytes ?? 0),
      contentSha256: item.content_sha256,
      status: item.status,
      reviewStatus: item.review_status,
      createdAt: isoDateTime(item.created_at),
    })),
    completion: submissions.map((submission) => ({
      id: submission.id,
      submittedByAccountId: submission.submitted_by_account_id,
      note: submission.note,
      checklist: submission.checklist ?? {},
      evidenceMediaIds: submission.evidence_media_ids ?? [],
      status: submission.status,
      submittedAt: isoDateTime(submission.submitted_at),
      resolvedAt: isoDateTime(submission.resolved_at),
      resolutions: resolutions
        .filter((resolution) => resolution.submission_id === submission.id)
        .map(mapCompletionResolution),
    })),
    updatedAt: isoDateTime(project.updated_at),
  };
}
