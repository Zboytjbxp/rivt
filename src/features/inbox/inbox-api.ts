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
    createdByAccountId: string;
    createdAt: string;
  }>;
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

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export class InboxApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message || "RIVT could not complete the inbox request.");
    this.name = "InboxApiError";
    this.status = status;
    this.code = body.error?.code || "REQUEST_FAILED";
    this.details = body.error?.details;
  }
}

function apiPath(path: string) {
  const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  return `${base}${path}`;
}

function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? `rivt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(apiPath(path), { credentials: "include", ...options });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (!response.ok) throw new InboxApiError(response.status, body);
  return body;
}

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

export async function sendConversationMessage(conversationId: string, bodyText: string) {
  const body = await request<{ data: { message: InboxMessage } }>(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ body: bodyText }),
  });
  return body.data.message;
}

export async function markConversationRead(conversationId: string) {
  const body = await request<{ data: { conversation: InboxConversation } }>(`/api/v1/conversations/${conversationId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return body.data.conversation;
}

export async function muteConversation(conversationId: string, mutedUntil: string | null) {
  const body = await request<{ data: { participant: InboxParticipant } }>(`/api/v1/conversations/${conversationId}/mute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutedUntil }),
  });
  return body.data.participant;
}

export async function reportConversation(conversationId: string, reason: "spam" | "harassment" | "suspicious" | "inappropriate" | "safety", note = "") {
  await request<{ data: { report: { id: string } } }>(`/api/v1/conversations/${conversationId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
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
