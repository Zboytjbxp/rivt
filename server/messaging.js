import { z } from "./api.js";

export const messageCreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z.array(z.object({
    uploadId: z.uuid().nullable().default(null),
    originalName: z.string().trim().max(240).default(""),
    mimeType: z.string().trim().max(120).default(""),
    sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024).nullable().default(null),
  })).max(5).default([]),
});

export const conversationMuteSchema = z.object({
  mutedUntil: z.iso.datetime({ offset: true }).nullable().default(null),
});

export const notificationReadSchema = z.object({
  ids: z.array(z.uuid()).max(100).default([]),
  all: z.boolean().default(false),
});

export const reportConversationSchema = z.object({
  reason: z.enum(["spam", "harassment", "suspicious", "inappropriate", "safety"]),
  note: z.string().trim().max(1000).default(""),
  reportedAccountId: z.uuid().nullable().default(null),
  messageId: z.uuid().nullable().default(null),
});

export const blockAccountSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});

export const notificationPreferenceSchema = z.object({
  notificationType: z.enum(["new_jobs", "new_applicants", "messages", "work_updates", "system"]),
  channel: z.enum(["in_app", "email", "push"]),
  enabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
});

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

export function mapConversation(row, { participants = [], lastMessage = null, unreadCount = 0 } = {}) {
  return {
    id: row.id,
    activeWorkId: row.active_work_id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    status: row.status,
    activeWorkStatus: row.active_work_status,
    createdByAccountId: row.created_by_account_id,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    job: {
      id: row.job_id,
      title: row.job_title,
      status: row.job_status,
      organization: { id: row.organization_id, name: row.organization_name },
      publicLocation: {
        city: row.public_city,
        region: row.public_region,
        countryCode: row.public_country_code,
      },
    },
    participants: participants.map(mapConversationParticipant),
    lastMessage: lastMessage ? mapMessage(lastMessage) : null,
    unreadCount,
  };
}

export function mapConversationParticipant(row) {
  return {
    accountId: row.account_id,
    role: row.participant_role,
    mutedUntil: isoDateTime(row.muted_until),
    lastReadAt: isoDateTime(row.last_read_at),
    displayName: row.display_name || "",
    headline: row.headline || "",
    serviceArea: {
      city: row.service_area_city || "",
      region: row.service_area_region || "",
    },
  };
}

export function mapMessage(row, { receipts = [], attachments = [] } = {}) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderAccountId: row.sender_account_id,
    body: row.body || "",
    kind: row.kind,
    createdAt: isoDateTime(row.created_at),
    editedAt: isoDateTime(row.edited_at),
    deletedAt: isoDateTime(row.deleted_at),
    sender: row.sender_display_name ? {
      accountId: row.sender_account_id,
      displayName: row.sender_display_name,
      headline: row.sender_headline || "",
    } : undefined,
    receipts: receipts.map(mapMessageReceipt),
    attachments: attachments.map(mapMessageAttachment),
  };
}

export function mapMessageReceipt(row) {
  return {
    messageId: row.message_id,
    accountId: row.account_id,
    deliveredAt: isoDateTime(row.delivered_at),
    readAt: isoDateTime(row.read_at),
  };
}

export function mapMessageAttachment(row) {
  return {
    id: row.id,
    messageId: row.message_id,
    uploadId: row.upload_id,
    originalName: row.original_name || "",
    mimeType: row.mime_type || "",
    sizeBytes: row.size_bytes,
    status: row.status,
    createdByAccountId: row.created_by_account_id,
    createdAt: isoDateTime(row.created_at),
  };
}

export function mapNotification(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    actionHref: row.action_href || "",
    sourceType: row.source_type || "",
    sourceId: row.source_id,
    priority: row.priority,
    metadata: row.metadata ?? {},
    readAt: isoDateTime(row.read_at),
    createdAt: isoDateTime(row.created_at),
  };
}

export function mapNotificationPreference(row) {
  return {
    notificationType: row.notification_type,
    channel: row.channel,
    enabled: row.enabled,
    quietHoursStart: row.quiet_hours_start ? String(row.quiet_hours_start).slice(0, 5) : null,
    quietHoursEnd: row.quiet_hours_end ? String(row.quiet_hours_end).slice(0, 5) : null,
    updatedAt: isoDateTime(row.updated_at),
  };
}
