import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Camera,
  CheckCheck,
  Clock3,
  MessageCircle,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import type { PrimaryDestination } from "../../app-shell/types";
import {
  archiveMessageTemplate,
  createMessageTemplate,
  getMessagingSettings,
  removeConversationAttachment,
  saveConversationPreference,
  setMessageReaction,
  uploadConversationAttachment,
  type ConversationPreference,
  type InboxConversation,
  type InboxMessage,
  type InboxNotification,
  type MessageTemplate,
  type StagedMessageAttachment,
} from "./inbox-api";
import { Avatar, EmptyState, PageHeader, Panel, SkeletonCard } from "../../components/ui";
import {
  emptyClientRecord,
  readClientRecordsLocal,
  saveClientRecordsLocal,
  syncClientRecords,
  upsertClientRecord,
  type ClientRecord,
  type ClientRecordMessage,
} from "../clients/client-records";
import { AccountCustomerNotesTab, type LegacyCustomer } from "./AccountCustomerNotesTab";
import "./inbox-center.css";

// ─── localStorage keys ────────────────────────────────────────────────────────
const TEMPLATES_KEY = "rivt.msgTemplates.v1";
const PINNED_KEY = "rivt.pinnedConvs.v1";
const ARCHIVED_KEY = "rivt.archivedConvs.v1";
const REACTIONS_KEY = "rivt.msgReactions.v1";
const CLIENT_THREADS_KEY = "rivt.clientThreads.v1";

const DEFAULT_TEMPLATES = [
  "Available and interested — can you share more details?",
  "What's the address / site location?",
  "My rate is $75/hr. Does that work for you?",
  "I'm booked this week but available next week.",
  "Can you send over the full scope of work?",
];

const EMOJI_OPTIONS = ["👍", "👎", "🔥", "✅", "❓", "😂"];

// ─── Client thread types ──────────────────────────────────────────────────────

type ClientContact = ClientRecord;

interface ClientMessage {
  id: string;
  text: string;
  sentAt: string;
  from: "me" | "client";
  attachmentUrl?: string;
}

type ClientThreads = Record<string, ClientMessage[]>;

function loadClientContacts(): ClientContact[] {
  return readClientRecordsLocal();
}

function loadClientThreads(): ClientThreads {
  try {
    const raw = localStorage.getItem(CLIENT_THREADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClientThreads;
      return Object.fromEntries(
        Object.entries(parsed).map(([clientId, messages]) => [clientId, privateClientNotes(messages)]),
      );
    }
  } catch { /* noop */ }
  return {};
}

function privateClientNotes(messages: ClientMessage[] = []): ClientMessage[] {
  return messages.filter((message) => message.from === "me");
}

function saveClientThreads(threads: ClientThreads) {
  try { localStorage.setItem(CLIENT_THREADS_KEY, JSON.stringify(threads)); } catch { /* noop */ }
}

function sanitizeClientThreadMessages(messages: ClientMessage[] = []): ClientRecordMessage[] {
  return messages
    .filter((message) => message.from === "me" && !message.attachmentUrl)
    .map(({ id, text, sentAt }) => ({ id, text, sentAt, from: "me" as const }))
    .slice(-100);
}

function sortMessages(messages: ClientMessage[]): ClientMessage[] {
  return [...messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

function mergeClientThreads(...sources: ClientThreads[]): ClientThreads {
  const merged: ClientThreads = {};
  for (const source of sources) {
    for (const [clientId, messages] of Object.entries(source)) {
      const byId = new Map<string, ClientMessage>();
      for (const message of [...(merged[clientId] ?? []), ...messages]) {
        if (message.from !== "me") continue;
        byId.set(message.id, message);
      }
      merged[clientId] = sortMessages([...byId.values()]);
    }
  }
  return merged;
}

function clientThreadsFromContacts(contacts: ClientContact[]): ClientThreads {
  const threads: ClientThreads = {};
  for (const contact of contacts) {
    if (contact.threadMessages?.length) {
      threads[contact.id] = privateClientNotes(contact.threadMessages.map((message) => ({ ...message })));
    }
  }
  return threads;
}

function contactWithThreadMessages(contact: ClientContact, messages: ClientMessage[]): ClientContact {
  return {
    ...contact,
    threadMessages: sanitizeClientThreadMessages(messages),
  };
}

// ─── Client Conversation UI ───────────────────────────────────────────────────

function ClientThread({
  contact,
  onBack,
  onThreadSync,
}: {
  contact: ClientContact;
  onBack: () => void;
  onThreadSync: (contact: ClientContact) => void;
}) {
  const [threads, setThreads] = useState<ClientThreads>(loadClientThreads);
  const [text, setText] = useState("");
  const [syncMessage, setSyncMessage] = useState(
    (contact.threadMessages?.length ?? 0) > 0 ? "Notes synced to your RIVT account." : "Notes saved on this device."
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const messages: ClientMessage[] = privateClientNotes(threads[contact.id] ?? []);

  function addNote(msg: ClientMessage) {
    setThreads((prev) => {
      const next: ClientThreads = { ...prev, [contact.id]: [...(prev[contact.id] ?? []), msg] };
      saveClientThreads(next);
      const updatedContact = contactWithThreadMessages(contact, next[contact.id] ?? []);
      onThreadSync(updatedContact);
      void upsertClientRecord(updatedContact).then((ok) => {
        setSyncMessage(ok ? "Notes synced to your RIVT account." : "Couldn't sync - notes are saved on this device only.");
      });
      return next;
    });
    // Scroll to bottom
    setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }, 30);
  }

  function handleSaveNote() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote({
      id: crypto.randomUUID(),
      text: trimmed,
      sentAt: new Date().toISOString(),
      from: "me",
    });
    setText("");
  }

  function handlePhotoAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addNote({
        id: crypto.randomUUID(),
        text: file.name,
        sentAt: new Date().toISOString(),
        from: "me",
        attachmentUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    // reset input
    e.target.value = "";
  }

  function timeLabel(iso: string) {
    // eslint-disable-next-line react-hooks/purity
    const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="v2-client-thread">
      <div className="v2-client-thread-header">
        <button type="button" className="v2-client-thread-back" onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <Avatar name={contact.name} size="sm" />
        <strong>{contact.name}</strong>
      </div>
      <p className="v2-client-thread-purpose">Private customer log. These notes are not sent to the customer.</p>
      <p className="v2-client-sync-note" role="status">{syncMessage}</p>

      <div className="v2-client-thread-messages" ref={messagesRef}>
        {messages.length === 0 ? (
          <div className="v2-client-thread-empty">No notes yet. Add job details or a follow-up reminder.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`v2-ct-bubble ${msg.from === "me" ? "is-mine" : "is-theirs"}`}>
              {msg.attachmentUrl ? (
                <img
                  src={msg.attachmentUrl}
                  alt={msg.text}
                  width="800"
                  height="600"
                  className="v2-ct-attachment"
                />
              ) : (
                <span className="v2-ct-text">{msg.text}</span>
              )}
              <time className="v2-ct-time">{timeLabel(msg.sentAt)}</time>
            </div>
          ))
        )}
      </div>

      <div className="v2-client-thread-input-bar">
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          className="v2-ct-file-input"
          onChange={handlePhotoAttach}
          aria-label="Attach reference photo"
        />
        <button
          type="button"
          className="v2-ct-photo-btn"
          onClick={() => fileRef.current?.click()}
          title="Attach reference photo"
          aria-label="Attach reference photo"
        >
          <Camera size={18} />
        </button>
        <input
          className="v2-ct-text-input"
          placeholder="Add a private note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveNote(); } }}
        />
        <button
          type="button"
          className="v2-ct-send-btn"
          disabled={!text.trim()}
          onClick={handleSaveNote}
          aria-label="Save note"
        >
          <Plus size={16} />
        </button>
      </div>

    </div>
  );
}

function LegacyCustomerNotesTab() {
  const [contacts, setContacts] = useState<ClientContact[]>(loadClientContacts);
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [addingName, setAddingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");

  useEffect(() => {
    let cancelled = false;
    void syncClientRecords().then((result) => {
      if (cancelled) return;
      const localThreads = loadClientThreads();
      const serverThreads = clientThreadsFromContacts(result.clients);
      const mergedThreads = mergeClientThreads(serverThreads, localThreads);
      saveClientThreads(mergedThreads);
      const contactsWithThreads = result.clients.map((contact) => contactWithThreadMessages(contact, mergedThreads[contact.id] ?? []));
      setContacts(contactsWithThreads);
      setSyncMessage(result.message);
      if (Object.keys(localThreads).length) {
        void Promise.all(
          contactsWithThreads
            .filter((contact) => mergedThreads[contact.id]?.length)
            .map((contact) => upsertClientRecord(contact))
        ).then((results) => {
          if (!cancelled && results.some(Boolean)) {
            setSyncMessage("Customer records and private notes synced to your RIVT account.");
          }
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  function addContact() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const c: ClientContact = emptyClientRecord(trimmed);
    const next = [c, ...contacts];
    setContacts(next);
    saveClientRecordsLocal(next);
    void upsertClientRecord(c).then((ok) => {
      setSyncMessage(ok ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
    setNewName("");
    setAddingName(false);
    setSelectedContact(c);
  }

  function getLastMessage(contactId: string): ClientMessage | null {
    try {
      const threads = loadClientThreads();
      const msgs = threads[contactId];
      if (msgs && msgs.length > 0) return msgs[msgs.length - 1];
    } catch { /* noop */ }
    return null;
  }

  function syncContactThread(updated: ClientContact) {
    setContacts((current) => {
      const next = current.map((contact) => contact.id === updated.id ? updated : contact);
      saveClientRecordsLocal(next);
      return next;
    });
    setSelectedContact(updated);
  }

  if (selectedContact) {
    return (
      <ClientThread
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
        onThreadSync={syncContactThread}
      />
    );
  }

  return (
    <div className="v2-clients-tab">
      <div className="v2-clients-tab-header">
        <span className="v2-client-title">Customer notes ({contacts.length})</span>
        {addingName ? (
          <div className="v2-ct-add-form">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addContact(); if (e.key === "Escape") { setAddingName(false); setNewName(""); } }}
              placeholder="Customer name"
            />
            <button type="button" className="v2-client-save-btn" disabled={!newName.trim()} onClick={addContact}>Add</button>
            <button type="button" className="v2-client-cancel-btn" aria-label="Cancel adding customer" title="Cancel" onClick={() => { setAddingName(false); setNewName(""); }}><X size={14} /></button>
          </div>
        ) : (
          <button type="button" className="v2-client-add-btn" onClick={() => setAddingName(true)}>
            <Plus size={14} /> New
          </button>
        )}
      </div>
      <p className="v2-client-sync-note" role="status">{syncMessage}</p>

      {contacts.length === 0 ? (
        <EmptyState
          className="v2-inbox-empty"
          icon={<Users size={20} />}
          title="No customer notes yet"
          description="Add a customer to keep private job and follow-up notes."
          compact
        />
      ) : (
        <div className="v2-clients-list">
          {contacts.map((c) => {
            const last = getLastMessage(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className="v2-client-conv-row"
                onClick={() => setSelectedContact(c)}
              >
                <Avatar name={c.name} size="sm" />
                <div className="v2-client-conv-info">
                  <strong>{c.name}</strong>
                  {last ? (
                    <span className="v2-client-conv-preview">
                      Note: {last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text}
                    </span>
                  ) : (
                    <span className="v2-client-conv-preview">No notes yet</span>
                  )}
                </div>
                {last && (
                  <time className="v2-client-conv-time">
                    {(() => {
                      const elapsed = Math.max(0, Date.now() - new Date(last.sentAt).getTime());
                      const minutes = Math.floor(elapsed / 60000);
                      if (minutes < 1) return "now";
                      if (minutes < 60) return `${minutes}m`;
                      const hours = Math.floor(minutes / 60);
                      if (hours < 24) return `${hours}h`;
                      return `${Math.floor(hours / 24)}d`;
                    })()}
                  </time>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

void LegacyCustomerNotesTab;

function CustomerNotesTab() {
  const [migrationVersion, setMigrationVersion] = useState(0);
  const legacyCustomers = (() => {
    void migrationVersion;
    const contacts = loadClientContacts();
    const threads = loadClientThreads();
    return contacts.flatMap((contact): LegacyCustomer[] => {
      const notes = privateClientNotes([
        ...(threads[contact.id] ?? []),
        ...(contact.threadMessages ?? []).map((message) => ({ ...message })),
      ]);
      if (!notes.length) return [];
      const unique = [...new Map(notes.map((note) => [note.id, note])).values()];
      return [{
        id: contact.id,
        name: contact.name,
        notes: unique.map((note) => ({
          id: note.id,
          text: note.text,
          sentAt: note.sentAt,
          attachmentUrl: note.attachmentUrl,
        })),
      }];
    });
  })();

  return (
    <AccountCustomerNotesTab
      legacyCustomers={legacyCustomers}
      onLegacyMigrationComplete={() => {
        try { localStorage.removeItem(CLIENT_THREADS_KEY); } catch { /* noop */ }
        saveClientRecordsLocal(loadClientContacts().map((contact) => ({ ...contact, threadMessages: [] })));
        setMigrationVersion((current) => current + 1);
      }}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface InboxCenterProps {
  accountId: string;
  conversations: InboxConversation[];
  selectedConversationId: string | null;
  messages: InboxMessage[];
  notifications: InboxNotification[];
  messageDraft: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  onSelectConversation: (conversationId: string) => void;
  onMessageDraft: (message: string) => void;
  onSendMessage: (attachments: StagedMessageAttachment[]) => Promise<boolean>;
  onMarkSelectedRead: () => void;
  onMarkNotificationsRead: () => void;
  onMuteSelected: () => void;
  onReportSelected: () => void;
  onRefresh: () => void;
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenNotification: (notification: InboxNotification) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeLabel(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function messageState(message: InboxMessage, accountId: string) {
  if (message.senderAccountId !== accountId) return "";
  const recipientReceipts = message.receipts.filter((receipt) => receipt.accountId !== accountId);
  if (recipientReceipts.some((receipt) => receipt.readAt)) return "read";
  if (recipientReceipts.some((receipt) => receipt.deliveredAt)) return "delivered";
  return "sent";
}

// ─── Inbox tab types ──────────────────────────────────────────────────────────
type InboxTab = "Messages" | "Customer notes";

// ─── Component ────────────────────────────────────────────────────────────────
export function InboxCenter({
  accountId,
  conversations,
  selectedConversationId,
  messages,
  notifications,
  messageDraft,
  loading,
  sending,
  error,
  onSelectConversation,
  onMessageDraft,
  onSendMessage,
  onMarkSelectedRead,
  onMarkNotificationsRead,
  onMuteSelected,
  onReportSelected,
  onRefresh,
  onNavigate,
  onOpenNotification,
}: InboxCenterProps) {
  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<InboxTab>("Messages");

  // ── Feature 1: Message Templates ──────────────────────────────────────────
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [preferences, setPreferences] = useState<Record<string, ConversationPreference>>({});
  const [settingsStatus, setSettingsStatus] = useState("Loading account-backed message settings…");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplateDraft, setNewTemplateDraft] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, InboxMessage["reactions"]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [stagedAttachments, setStagedAttachments] = useState<StagedMessageAttachment[]>([]);
  const [failedAttachment, setFailedAttachment] = useState<{ file: File; error: string } | null>(null);
  const [removedMessageAttachmentIds, setRemovedMessageAttachmentIds] = useState<Set<string>>(new Set());
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [hasLegacyReactions, setHasLegacyReactions] = useState(() => {
    try { return Boolean(localStorage.getItem(REACTIONS_KEY)); } catch { return false; }
  });
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const settings = await getMessagingSettings();
        if (cancelled) return;
        const nextPreferences = Object.fromEntries(
          settings.conversationPreferences.map((preference) => [preference.conversationId, preference]),
        );
        setPreferences(nextPreferences);
        setTemplates(settings.templates.filter((template) => !template.archivedAt));

        const legacyTemplates = (() => {
          try {
            const stored = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "null") as string[] | null;
            return stored ?? (settings.templates.length ? [] : DEFAULT_TEMPLATES);
          } catch {
            return settings.templates.length ? [] : DEFAULT_TEMPLATES;
          }
        })();
        const legacyPinned = (() => {
          try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? "[]") as string[]; } catch { return []; }
        })();
        const legacyArchived = (() => {
          try { return JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? "[]") as string[]; } catch { return []; }
        })();
        const migratedTemplates: MessageTemplate[] = [];
        for (const [index, text] of legacyTemplates.entries()) {
          if (!text.trim() || settings.templates.some((template) => template.body === text.trim())) continue;
          migratedTemplates.push(await createMessageTemplate(text.trim(), index));
        }
        const migratedPreferences: ConversationPreference[] = [];
        const unmatchedPinned = legacyPinned.filter((conversationId) => !conversations.some((conversation) => conversation.id === conversationId));
        const unmatchedArchived = legacyArchived.filter((conversationId) => !conversations.some((conversation) => conversation.id === conversationId));
        for (const conversationId of new Set([...legacyPinned, ...legacyArchived])) {
          if (!conversations.some((conversation) => conversation.id === conversationId)) continue;
          const current = nextPreferences[conversationId];
          migratedPreferences.push(await saveConversationPreference(conversationId, {
            pinned: legacyPinned.includes(conversationId) || current?.pinned || false,
            archived: legacyArchived.includes(conversationId) || current?.archived || false,
            expectedVersion: current?.version ?? 0,
          }));
        }
        if (cancelled) return;
        if (migratedTemplates.length) setTemplates((current) => [...current, ...migratedTemplates]);
        if (migratedPreferences.length) {
          setPreferences((current) => ({
            ...current,
            ...Object.fromEntries(migratedPreferences.map((item) => [item.conversationId, item])),
          }));
        }
        try {
          localStorage.removeItem(TEMPLATES_KEY);
          if (unmatchedPinned.length) localStorage.setItem(PINNED_KEY, JSON.stringify(unmatchedPinned));
          else localStorage.removeItem(PINNED_KEY);
          if (unmatchedArchived.length) localStorage.setItem(ARCHIVED_KEY, JSON.stringify(unmatchedArchived));
          else localStorage.removeItem(ARCHIVED_KEY);
        } catch { /* noop */ }
        setSettingsStatus(
          unmatchedPinned.length || unmatchedArchived.length
            ? "Some device thread settings do not match a currently loaded work thread and were kept on this device."
            : localStorage.getItem(REACTIONS_KEY)
            ? "Message settings synced. Previous private reactions remain only on this device."
            : "Message settings synced to your RIVT account.",
        );
      } catch (settingsError) {
        if (!cancelled) setSettingsStatus(settingsError instanceof Error ? settingsError.message : "Message settings could not sync.");
      }
    }
    void loadSettings();
    return () => { cancelled = true; };
  }, [conversations]);

  async function addTemplate() {
    const trimmed = newTemplateDraft.trim();
    if (!trimmed) return;
    try {
      const template = await createMessageTemplate(trimmed, templates.length);
      setTemplates((current) => [...current, template]);
      setNewTemplateDraft("");
      setAddingTemplate(false);
      setSettingsStatus("Template saved to your RIVT account.");
    } catch (templateError) {
      setSettingsStatus(templateError instanceof Error ? templateError.message : "Template could not be saved.");
    }
  }

  async function deleteTemplate(template: MessageTemplate) {
    try {
      await archiveMessageTemplate(template);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setSettingsStatus("Template archived.");
    } catch (templateError) {
      setSettingsStatus(templateError instanceof Error ? templateError.message : "Template could not be archived.");
    }
  }

  // ── Feature 2: Pin Conversations ──────────────────────────────────────────
  const pinnedIds = new Set(Object.values(preferences).filter((item) => item.pinned).map((item) => item.conversationId));

  // ── Feature 3: Archive Conversations ─────────────────────────────────────
  const archivedIds = new Set(Object.values(preferences).filter((item) => item.archived).map((item) => item.conversationId));
  const [showArchived, setShowArchived] = useState(false);

  async function updatePreference(id: string, change: "pin" | "archive") {
    const current = preferences[id];
    try {
      const preference = await saveConversationPreference(id, {
        pinned: change === "pin" ? !current?.pinned : current?.pinned ?? false,
        archived: change === "archive" ? !current?.archived : current?.archived ?? false,
        expectedVersion: current?.version ?? 0,
      });
      setPreferences((items) => ({ ...items, [id]: preference }));
      setSettingsStatus(change === "pin" ? (preference.pinned ? "Thread pinned." : "Thread unpinned.") : (preference.archived ? "Thread archived." : "Thread restored."));
    } catch (preferenceError) {
      setSettingsStatus(preferenceError instanceof Error ? preferenceError.message : "Thread setting could not be saved.");
    }
  }

  // ── Feature 4: Emoji Reactions ────────────────────────────────────────────
  async function changeReaction(message: InboxMessage, emoji: string) {
    if (!selectedConversationId) return;
    const current = reactionOverrides[message.id] ?? message.reactions ?? [];
    const existing = current.find((reaction) => reaction.reactedByMe)?.emoji ?? null;
    try {
      const next = await setMessageReaction(selectedConversationId, message.id, existing === emoji ? null : emoji);
      setReactionOverrides((items) => ({ ...items, [message.id]: next }));
    } catch (reactionError) {
      setSettingsStatus(reactionError instanceof Error ? reactionError.message : "Reaction could not be saved.");
    }
    setReactionPickerFor(null);
  }

  function selectConversation(conversationId: string) {
    setStagedAttachments([]);
    setAttachmentError(null);
    setFailedAttachment(null);
    setRemovedMessageAttachmentIds(new Set());
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    onSelectConversation(conversationId);
  }

  async function stageAttachment(file: File) {
    if (!selectedConversationId) return;
    setUploadingAttachment(true);
    setAttachmentError(null);
    setFailedAttachment(null);
    try {
      const attachment = await uploadConversationAttachment(selectedConversationId, file);
      setStagedAttachments((current) => [...current, attachment]);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Attachment could not be uploaded.";
      setAttachmentError(message);
      setFailedAttachment({ file, error: message });
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  async function removeStagedAttachment(attachment: StagedMessageAttachment) {
    if (!selectedConversationId) return;
    try {
      await removeConversationAttachment(selectedConversationId, attachment.id);
      setStagedAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (removeError) {
      setAttachmentError(removeError instanceof Error ? removeError.message : "Attachment could not be removed.");
    }
  }

  async function removeSentAttachment(attachmentId: string) {
    if (!selectedConversationId) return;
    try {
      await removeConversationAttachment(selectedConversationId, attachmentId);
      setRemovedMessageAttachmentIds((current) => new Set([...current, attachmentId]));
      setSettingsStatus("Message attachment removed.");
      onRefresh();
    } catch (removeError) {
      setAttachmentError(removeError instanceof Error ? removeError.message : "Attachment could not be removed.");
    }
  }

  async function sendMessage() {
    const sent = await onSendMessage(stagedAttachments);
    if (sent) {
      setStagedAttachments([]);
      setAttachmentError(null);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const unreadThreads = conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId) ?? null;
  const otherParticipants =
    selectedConversation?.participants.filter((p) => p.accountId !== accountId) ?? [];
  const canSend = Boolean(
    selectedConversation
    && (messageDraft.trim() || stagedAttachments.length)
    && !sending
    && !uploadingAttachment,
  );

  // Build sorted, filtered conversation list
  const visibleConversations = showArchived
    ? conversations.filter((c) => archivedIds.has(c.id))
    : conversations.filter((c) => !archivedIds.has(c.id));

  const pinnedConversations = visibleConversations.filter((c) => pinnedIds.has(c.id));
  const unpinnedConversations = visibleConversations.filter((c) => !pinnedIds.has(c.id));

  const archivedCount = archivedIds.size;

  // ─── Tab bar ──────────────────────────────────────────────────────────────
  const tabBar = (
    <div className="v2-inbox-tabs">
      {(["Messages", "Customer notes"] as InboxTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`v2-inbox-tab${activeTab === tab ? " is-active" : ""}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab === "Messages" ? <MessageCircle size={15} /> : <Users size={15} />}
          {tab}
        </button>
      ))}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="v2-inbox-page" aria-label="Inbox">
      <PageHeader
        className="v2-inbox-header"
        title="Inbox"
        description={`${unreadThreads} unread messages · ${unreadNotifications.length} new updates`}
      />

      {error ? (
        <article className="v2-inbox-alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Retry</button>
        </article>
      ) : null}

      {/* Tab bar */}
      {tabBar}

      {/* Customer notes tab */}
      {activeTab === "Customer notes" ? (
        <div className="v2-inbox-clients-wrapper">
          <CustomerNotesTab />
        </div>
      ) : (
        <div className="v2-inbox-grid">
          {/* ── Thread List Panel ── */}
          <Panel
            className="v2-inbox-panel"
            eyebrow="Threads"
            title="Accepted work only"
            action={<button type="button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>}
          >
            {/* Archive toggle */}
            <div className="v2-inbox-list-toolbar">
              <button
                type="button"
                className={showArchived ? "v2-archived-toggle active" : "v2-archived-toggle"}
                onClick={() => setShowArchived((v) => !v)}
              >
                <Archive size={12} />
                Archived ({archivedCount})
              </button>
            </div>

            <div className="v2-inbox-thread-list">
              {loading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : visibleConversations.length ? (
                <>
                  {/* Pinned section */}
                  {!showArchived && pinnedConversations.length > 0 && (
                    <>
                      <div className="v2-conv-section-label">Pinned</div>
                      {pinnedConversations.map((conversation) => (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          isActive={conversation.id === selectedConversationId}
                          isPinned={pinnedIds.has(conversation.id)}
                          isArchived={archivedIds.has(conversation.id)}
                          onSelect={selectConversation}
                          onTogglePin={(id) => void updatePreference(id, "pin")}
                          onToggleArchive={(id) => void updatePreference(id, "archive")}
                        />
                      ))}
                      {unpinnedConversations.length > 0 && (
                        <div className="v2-conv-section-label">All messages</div>
                      )}
                    </>
                  )}

                  {/* Unpinned / all conversations */}
                  {unpinnedConversations.map((conversation) => (
                    <ConversationRow
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === selectedConversationId}
                      isPinned={pinnedIds.has(conversation.id)}
                      isArchived={archivedIds.has(conversation.id)}
                      onSelect={selectConversation}
                      onTogglePin={(id) => void updatePreference(id, "pin")}
                      onToggleArchive={(id) => void updatePreference(id, "archive")}
                    />
                  ))}

                  {/* Show archived-only empty state */}
                  {showArchived && visibleConversations.length === 0 && (
                    <EmptyState
                      className="v2-inbox-empty"
                      icon={<Archive size={20} />}
                      title="No archived threads"
                      description="Archived conversations will appear here."
                      compact
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  className="v2-inbox-empty"
                  icon={<MessageCircle size={20} />}
                  title={showArchived ? "No archived threads" : "No work threads yet"}
                  description={
                    showArchived
                      ? "Archived conversations will appear here."
                      : "A thread opens after a contractor offer is accepted."
                  }
                  action={
                    !showArchived ? (
                      <button type="button" onClick={() => onNavigate("work")}>Open Work</button>
                    ) : undefined
                  }
                  compact
                />
              )}
            </div>
          </Panel>

          {/* ── Conversation Panel ── */}
          <Panel
            className="v2-inbox-panel v2-inbox-panel-thread"
            eyebrow="Conversation"
            title={selectedConversation ? selectedConversation.job.title : "Select a thread"}
            action={
              selectedConversation ? (
                <div className="v2-inbox-header-actions">
                  <button type="button" onClick={onMarkSelectedRead}><CheckCheck size={14} /> Read</button>
                  <button type="button" onClick={onMuteSelected}><VolumeX size={14} /> Mute</button>
                  <button type="button" onClick={onReportSelected}><ShieldAlert size={14} /> Report</button>
                </div>
              ) : null
            }
          >
            {selectedConversation ? (
              <>
                <div className="v2-inbox-context">
                  <strong>{selectedConversation.job.organization.name}</strong>
                  <span>{selectedConversation.job.publicLocation.city}, {selectedConversation.job.publicLocation.region}</span>
                  <small>{otherParticipants.map((p) => p.displayName).join(", ") || "Work participant"}</small>
                </div>

                {/* ── Message List ── */}
                <div
                  className="v2-inbox-message-list"
                  onClick={() => setReactionPickerFor(null)}
                >
                  {messages.length ? messages.map((message) => {
                    const mine = message.senderAccountId === accountId;
                    const state = messageState(message, accountId);
                    const messageReactions = reactionOverrides[message.id] ?? message.reactions ?? [];
                    const existingReaction = messageReactions.find((reaction) => reaction.reactedByMe)?.emoji ?? null;
                    const pickerOpen = reactionPickerFor === message.id;

                    return (
                      <article
                        key={message.id}
                        className={mine ? "v2-inbox-message is-mine" : "v2-inbox-message"}
                      >
                        <small>{message.sender?.displayName || "RIVT member"} - {timeLabel(message.createdAt)}</small>
                        <p>{message.body}</p>
                        {message.attachments?.some((attachment) => !removedMessageAttachmentIds.has(attachment.id)) ? (
                          <div className="v2-msg-attachments">
                            {message.attachments.filter((attachment) => !removedMessageAttachmentIds.has(attachment.id)).map((attachment) => (
                              <div key={attachment.id} className="v2-msg-attachment">
                                <a href={attachment.url ?? undefined} target="_blank" rel="noreferrer">
                                  <Paperclip size={14} />
                                  <span>{attachment.originalName}</span>
                                  <small>{attachment.sizeBytes ? `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB` : "File"}</small>
                                </a>
                                {mine ? (
                                  <button type="button" onClick={() => void removeSentAttachment(attachment.id)} aria-label={`Remove ${attachment.originalName}`}>
                                    <X size={13} />
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {state ? <span><CheckCheck size={12} /> {state}</span> : null}

                        {/* Emoji picker + reaction pill */}
                        <div className="v2-msg-reaction-row">
                          {messageReactions.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              type="button"
                              className={`v2-msg-reaction-pill${reaction.reactedByMe ? " is-mine" : ""}`}
                              onClick={(event) => { event.stopPropagation(); void changeReaction(message, reaction.emoji); }}
                              aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="v2-msg-reaction-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionPickerFor(pickerOpen ? null : message.id);
                            }}
                            title="React to this message"
                            aria-label="React to this message"
                          >
                            {existingReaction ? "…" : "☺"}
                          </button>
                          {pickerOpen && (
                            <div
                              className="v2-msg-reaction-picker"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={`v2-msg-reaction-btn${existingReaction === emoji ? " is-active" : ""}`}
                                  onClick={() => void changeReaction(message, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }) : (
                    <EmptyState
                      className="v2-inbox-empty"
                      icon={<Clock3 size={20} />}
                      title="No messages yet"
                      description="Send the first update when you have a real work question."
                      compact
                    />
                  )}
                </div>

                {/* ── Templates bar ── */}
                <div className="v2-msg-templates-section">
                  <button
                    type="button"
                    className="v2-templates-toggle"
                    onClick={() => setTemplatesOpen((v) => !v)}
                  >
                    Templates {templatesOpen ? "▲" : "▼"}
                  </button>

                  {templatesOpen && (
                    <div className="v2-msg-templates-bar">
                      {templates.map((template) => (
                        <span key={template.id} className="v2-msg-template-chip">
                          <button
                            type="button"
                            onClick={() => onMessageDraft(template.body)}
                            title={template.body}
                          >
                            {template.body.length > 35 ? `${template.body.slice(0, 35)}…` : template.body}
                          </button>
                          <button
                            type="button"
                            className="v2-msg-template-chip-delete"
                            onClick={() => void deleteTemplate(template)}
                            title="Archive template"
                            aria-label="Archive template"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}

                      {addingTemplate ? (
                        <span className="v2-msg-template-add-form">
                          <input
                            autoFocus
                            type="text"
                            value={newTemplateDraft}
                            onChange={(e) => setNewTemplateDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void addTemplate();
                              if (e.key === "Escape") { setAddingTemplate(false); setNewTemplateDraft(""); }
                            }}
                            placeholder="New template text…"
                          />
                          <button type="button" onClick={() => void addTemplate()}>Save</button>
                          <button type="button" aria-label="Cancel adding template" title="Cancel" onClick={() => { setAddingTemplate(false); setNewTemplateDraft(""); }}>
                            <X size={12} />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="v2-msg-template-chip-add"
                          onClick={() => setAddingTemplate(true)}
                          title="Add template"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Composer ── */}
                <label className="v2-inbox-composer">
                  <span>Message</span>
                  <textarea
                    value={messageDraft}
                    onChange={(event) => onMessageDraft(event.target.value)}
                    placeholder="Write a job update, schedule question, or site note."
                  />
                </label>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="v2-ct-file-input"
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void stageAttachment(file);
                  }}
                  aria-label="Attach a file to this message"
                />
                {stagedAttachments.length ? (
                  <div className="v2-msg-staged" aria-label="Files ready to send">
                    {stagedAttachments.map((attachment) => (
                      <span key={attachment.id}>
                        <Paperclip size={13} />
                        {attachment.originalName}
                        <button type="button" onClick={() => void removeStagedAttachment(attachment)} aria-label={`Remove ${attachment.originalName}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {failedAttachment ? (
                  <div className="v2-msg-upload-failed" role="alert">
                    <span><Paperclip size={13} /> {failedAttachment.file.name} was not uploaded.</span>
                    <button type="button" onClick={() => void stageAttachment(failedAttachment.file)}>Retry</button>
                    <button type="button" onClick={() => { setFailedAttachment(null); setAttachmentError(null); }}>Remove</button>
                  </div>
                ) : null}
                {attachmentError ? <p className="v2-msg-attachment-error" role="alert">{attachmentError}</p> : null}
                <div className="v2-inbox-composer-actions">
                  <button type="button" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingAttachment || stagedAttachments.length >= 5}>
                    <Paperclip size={16} /> {uploadingAttachment ? "Uploading…" : "Attach"}
                  </button>
                  <button type="button" className="v2-primary-button" onClick={() => void sendMessage()} disabled={!canSend}>
                    <Send size={16} />
                    {sending ? "Sending" : "Send"}
                  </button>
                  <button type="button" onClick={() => onNavigate("work")}>Open job</button>
                </div>
                <p className="v2-client-sync-note" role="status">{settingsStatus}</p>
                {hasLegacyReactions ? (
                  <div className="v2-msg-legacy-reactions">
                    <span>Old reactions were private to this device. New reactions are visible to work participants.</span>
                    <button
                      type="button"
                      onClick={() => {
                        try { localStorage.removeItem(REACTIONS_KEY); } catch { /* noop */ }
                        setHasLegacyReactions(false);
                        setSettingsStatus("Old device-only reactions cleared.");
                      }}
                    >
                      Clear old private reactions
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                className="v2-inbox-empty v2-inbox-empty-large"
                icon={<MessageCircle size={24} />}
                title="Select a work thread"
                description="Messages are only available between accepted work participants."
              />
            )}
          </Panel>

          {/* ── Notifications Panel ── */}
          <Panel
            className="v2-inbox-panel v2-inbox-panel-wide"
            eyebrow="Notifications"
            title="What changed since you last checked"
            action={
              <button type="button" onClick={onMarkNotificationsRead} disabled={!unreadNotifications.length}>
                <Bell size={14} />
                Mark all read
              </button>
            }
          >
            <div className="v2-inbox-list">
              {notifications.length ? notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.readAt ? "v2-inbox-item" : "v2-inbox-item unread"}
                  onClick={() => onOpenNotification(item)}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                  <small>{timeLabel(item.createdAt)}</small>
                </button>
              )) : (
                <EmptyState
                  className="v2-inbox-empty"
                  icon={<Bell size={20} />}
                  title="No notifications yet"
                  description="Offers, accepted work, and new messages will show here."
                  compact
                />
              )}
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

// ─── ConversationRow sub-component ───────────────────────────────────────────
interface ConversationRowProps {
  conversation: InboxConversation;
  isActive: boolean;
  isPinned: boolean;
  isArchived: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
}

function ConversationRow({
  conversation,
  isActive,
  isPinned,
  isArchived,
  onSelect,
  onTogglePin,
  onToggleArchive,
}: ConversationRowProps) {
  const classes = [
    "v2-inbox-thread",
    isActive ? "is-active" : "",
    isPinned ? "v2-conv-pinned" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="v2-inbox-thread-wrapper">
      <button
        type="button"
        className={classes}
        onClick={() => onSelect(conversation.id)}
      >
        <span>
          <strong>{conversation.job.title}</strong>
          <small>{conversation.job.publicLocation.city}, {conversation.job.publicLocation.region}</small>
        </span>
        {conversation.unreadCount > 0 ? <b>{conversation.unreadCount}</b> : null}
        <em>{conversation.lastMessage ? timeLabel(conversation.lastMessage.createdAt) : "new"}</em>
      </button>
      <div className="v2-inbox-thread-row-actions">
        <button
          type="button"
          className={`v2-conv-pin-btn${isPinned ? " is-pinned" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(conversation.id); }}
          title={isPinned ? "Unpin" : "Pin"}
          aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
        >
          <Pin size={13} />
        </button>
        <button
          type="button"
          className={`v2-conv-archive-btn${isArchived ? " is-archived" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleArchive(conversation.id); }}
          title={isArchived ? "Unarchive" : "Archive"}
          aria-label={isArchived ? "Unarchive conversation" : "Archive conversation"}
        >
          <Archive size={13} />
        </button>
      </div>
    </div>
  );
}
