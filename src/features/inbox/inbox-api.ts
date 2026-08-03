import {
  type ApiErrorBody,
  RivtApiError,
  RIVT_EXPECTED_ACCOUNT_HEADER,
  requestKey,
  makeRequest,
} from "../../lib/api";

export interface InboxParticipant {
  accountId: string;
  role: "contractor" | "tradesperson";
  mutedUntil: string | null;
  lastReadAt: string | null;
  displayName: string;
  headline: string;
  serviceArea: { city: string; region: string };
}

export interface InboxConversation {
  id: string;
  activeWorkId: string;
  jobId: string;
  organizationId: string;
  status: "open" | "closed";
  activeWorkStatus: "active" | "cancelled" | "completed";
  createdByAccountId: string;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    status: string;
    organization: { id: string; name: string };
    publicLocation: { city: string; region: string; countryCode: string };
  };
  participants: InboxParticipant[];
  lastMessage: InboxMessage | null;
  unreadCount: number;
}

export interface InboxMessage {
  id: string;
  conversationId: string;
  senderAccountId: string;
  body: string;
  kind: "user" | "system";
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: {
    accountId: string;
    displayName: string;
    headline: string;
  };
  receipts: Array<{
    messageId: string;
    accountId: string;
    deliveredAt: string;
    readAt: string | null;
  }>;
  attachments: Array<{
    id: string;
    messageId: string;
    uploadId: string | null;
    originalName: string;
    mimeType: string;
    sizeBytes: number | null;
    status: "pending_authorization" | "attached" | "rejected";
    version: number;
    url: string | null;
    createdByAccountId: string;
    createdAt: string;
  }>;
  reactions: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
}

export interface ConversationPreference {
  conversationId: string;
  pinned: boolean;
  archived: boolean;
  version: number;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  body: string;
  sortOrder: number;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StagedMessageAttachment {
  id: string;
  uploadId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending_authorization";
  url: string | null;
}

export interface InboxNotification {
  id: string;
  accountId: string;
  type: "message" | "work" | "system";
  title: string;
  body: string;
  actionHref: string;
  sourceType: string;
  sourceId: string | null;
  priority: "low" | "normal" | "high";
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export class InboxApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the inbox request.");
    this.name = "InboxApiError";
  }
}

const request = makeRequest((s, b) => new InboxApiError(s, b));

export async function listConversations() {
  const body = await request<{ data: { conversations: InboxConversation[] } }>("/api/v1/conversations");
  return body.data.conversations;
}

export async function openActiveWorkConversation(activeWorkId: string) {
  const body = await request<{ data: { conversation: InboxConversation } }>(`/api/v1/active-work/${activeWorkId}/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({}),
  });
  return body.data.conversation;
}

export async function listConversationMessages(conversationId: string) {
  const body = await request<{ data: { messages: InboxMessage[] } }>(`/api/v1/conversations/${conversationId}/messages`);
  return body.data.messages;
}

export async function sendConversationMessage(
  conversationId: string,
  bodyText: string,
  attachments: Array<Pick<StagedMessageAttachment, "uploadId">> = [],
) {
  const body = await request<{ data: { message: InboxMessage } }>(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ body: bodyText, attachments }),
  });
  return body.data.message;
}

export async function getMessagingSettings() {
  const body = await request<{
    data: {
      conversationPreferences: ConversationPreference[];
      templates: MessageTemplate[];
    };
  }>("/api/v1/messaging/settings");
  return body.data;
}

export async function saveConversationPreference(
  conversationId: string,
  input: Pick<ConversationPreference, "pinned" | "archived"> & { expectedVersion: number },
) {
  const body = await request<{ data: { preference: ConversationPreference } }>(
    `/api/v1/conversations/${conversationId}/preference`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return body.data.preference;
}

export async function createMessageTemplate(bodyText: string, sortOrder = 0) {
  const body = await request<{ data: { template: MessageTemplate } }>("/api/v1/message-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ body: bodyText, sortOrder }),
  });
  return body.data.template;
}

export async function archiveMessageTemplate(template: MessageTemplate) {
  const body = await request<{ data: { template: MessageTemplate } }>(
    `/api/v1/message-templates/${template.id}/archive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: template.version }),
    },
  );
  return body.data.template;
}

export async function setMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: string | null,
) {
  const body = await request<{ data: { reactions: InboxMessage["reactions"] } }>(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/reaction`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    },
  );
  return body.data.reactions;
}

export async function uploadConversationAttachment(conversationId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const body = await request<{ data: { attachment: StagedMessageAttachment } }>(
    `/api/v1/conversations/${conversationId}/attachments`,
    { method: "POST", body: form },
  );
  return body.data.attachment;
}

export async function removeConversationAttachment(conversationId: string, attachmentId: string) {
  await request<{ data: { removed: boolean } }>(
    `/api/v1/conversations/${conversationId}/attachments/${attachmentId}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
  );
}

export async function markConversationRead(conversationId: string) {
  const body = await request<{ data: { conversation: InboxConversation } }>(`/api/v1/conversations/${conversationId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return body.data.conversation;
}

export async function muteConversation(conversationId: string, mutedUntil: string | null, expectedAccountId: string) {
  const body = await request<{ data: { participant: InboxParticipant } }>(`/api/v1/conversations/${conversationId}/mute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [RIVT_EXPECTED_ACCOUNT_HEADER]: expectedAccountId,
    },
    body: JSON.stringify({ mutedUntil }),
  });
  return body.data.participant;
}

export async function reportConversation(
  conversationId: string,
  reason: "spam" | "harassment" | "suspicious" | "inappropriate" | "safety",
  note: string,
  expectedAccountId: string,
) {
  await request<{ data: { report: { id: string } } }>(`/api/v1/conversations/${conversationId}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
      [RIVT_EXPECTED_ACCOUNT_HEADER]: expectedAccountId,
    },
    body: JSON.stringify({ reason, note }),
  });
}

export async function listNotifications() {
  const body = await request<{ data: { notifications: InboxNotification[]; unreadCount: number } }>("/api/v1/notifications");
  return body.data;
}

export async function markNotificationsRead(ids: string[] = [], all = false) {
  const body = await request<{ data: { unreadCount: number } }>("/api/v1/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, all }),
  });
  return body.data.unreadCount;
}
