import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Camera,
  CheckCheck,
  Clock3,
  MessageCircle,
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
import type { InboxConversation, InboxMessage, InboxNotification } from "./inbox-api";
import { Avatar, EmptyState, PageHeader, Panel, SkeletonCard } from "../../components/ui";
import {
  readClientRecordsLocal,
  saveClientRecordsLocal,
  syncClientRecords,
  upsertClientRecord,
  type ClientRecord,
  type ClientRecordMessage,
} from "../clients/client-records";
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

function saveClientThreads(threads: ClientThreads) {
  try { localStorage.setItem(CLIENT_THREADS_KEY, JSON.stringify(threads)); } catch { /* noop */ }
}

function privateClientNotes(messages: ClientMessage[] = []): ClientMessage[] {
  return messages.filter((message) => message.from === "me");
}

function sanitizeClientThreadMessages(messages: ClientMessage[] = []): ClientRecordMessage[] {
  return messages
    .filter((message) => message.from === "me" && !message.attachmentUrl)
    .map(({ id, text, sentAt, from }) => ({ id, text, sentAt, from }))
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
      <p className="v2-client-thread-purpose">Private client log. These notes are not sent to the client.</p>
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

function ClientsTab() {
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
            setSyncMessage("Client records and private notes synced to your RIVT account.");
          }
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  function addContact() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const c: ClientContact = {
      id: crypto.randomUUID(),
      name: trimmed,
      company: "",
      phone: "",
      email: "",
      notes: "",
      createdAt: new Date().toISOString(),
      threadMessages: [],
    };
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
        <span className="v2-client-title">Client notes ({contacts.length})</span>
        {addingName ? (
          <div className="v2-ct-add-form">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addContact(); if (e.key === "Escape") { setAddingName(false); setNewName(""); } }}
              placeholder="Client name"
            />
            <button type="button" className="v2-client-save-btn" disabled={!newName.trim()} onClick={addContact}>Add</button>
            <button type="button" className="v2-client-cancel-btn" onClick={() => { setAddingName(false); setNewName(""); }}><X size={14} /></button>
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
          title="No client notes yet"
          description="Add a client to keep private job and follow-up notes."
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
  onSendMessage: () => void;
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
type InboxTab = "Messages" | "Client notes";

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
  const [templates, setTemplates] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "null") as string[] | null;
      return saved ?? DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplateDraft, setNewTemplateDraft] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);

  function saveTemplates(next: string[]) {
    setTemplates(next);
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }

  function addTemplate() {
    const trimmed = newTemplateDraft.trim();
    if (!trimmed) return;
    saveTemplates([...templates, trimmed]);
    setNewTemplateDraft("");
    setAddingTemplate(false);
  }

  function deleteTemplate(index: number) {
    saveTemplates(templates.filter((_, i) => i !== index));
  }

  // ── Feature 2: Pin Conversations ──────────────────────────────────────────
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  // ── Feature 3: Archive Conversations ─────────────────────────────────────
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const [showArchived, setShowArchived] = useState(false);

  function toggleArchive(id: string) {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  // ── Feature 4: Emoji Reactions ────────────────────────────────────────────
  const [reactions, setReactions] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(REACTIONS_KEY) ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  function setReaction(messageId: string, emoji: string) {
    setReactions((prev) => {
      const next = { ...prev };
      if (next[messageId] === emoji) delete next[messageId];
      else next[messageId] = emoji;
      try { localStorage.setItem(REACTIONS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    setReactionPickerFor(null);
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const unreadThreads = conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId) ?? null;
  const otherParticipants =
    selectedConversation?.participants.filter((p) => p.accountId !== accountId) ?? [];
  const canSend = Boolean(selectedConversation && messageDraft.trim() && !sending);

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
      {(["Messages", "Client notes"] as InboxTab[]).map((tab) => (
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

      {/* Clients tab */}
      {activeTab === "Client notes" ? (
        <div className="v2-inbox-clients-wrapper">
          <ClientsTab />
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
                          onSelect={onSelectConversation}
                          onTogglePin={togglePin}
                          onToggleArchive={toggleArchive}
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
                      onSelect={onSelectConversation}
                      onTogglePin={togglePin}
                      onToggleArchive={toggleArchive}
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
                    const existingReaction = reactions[message.id];
                    const pickerOpen = reactionPickerFor === message.id;

                    return (
                      <article
                        key={message.id}
                        className={mine ? "v2-inbox-message is-mine" : "v2-inbox-message"}
                      >
                        <small>{message.sender?.displayName || "RIVT member"} - {timeLabel(message.createdAt)}</small>
                        <p>{message.body}</p>
                        {state ? <span><CheckCheck size={12} /> {state}</span> : null}

                        {/* Emoji picker + reaction pill */}
                        <div className="v2-msg-reaction-row">
                          {existingReaction && (
                            <>
                              <button
                                type="button"
                                className="v2-msg-reaction-pill"
                                onClick={(e) => { e.stopPropagation(); setReaction(message.id, existingReaction); }}
                                title="Remove private reaction"
                                aria-label="Remove private reaction"
                              >
                                {existingReaction}
                              </button>
                              <span className="v2-msg-reaction-private">Private to you</span>
                            </>
                          )}
                          <button
                            type="button"
                            className="v2-msg-reaction-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionPickerFor(pickerOpen ? null : message.id);
                            }}
                            title="Add a private reaction"
                            aria-label="Add a private reaction"
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
                                  onClick={() => setReaction(message.id, emoji)}
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
                      {templates.map((tpl, i) => (
                        <span key={i} className="v2-msg-template-chip">
                          <button
                            type="button"
                            onClick={() => onMessageDraft(tpl)}
                            title={tpl}
                          >
                            {tpl.length > 35 ? tpl.slice(0, 35) + "…" : tpl}
                          </button>
                          <button
                            type="button"
                            className="v2-msg-template-chip-delete"
                            onClick={() => deleteTemplate(i)}
                            title="Remove template"
                            aria-label="Remove template"
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
                              if (e.key === "Enter") addTemplate();
                              if (e.key === "Escape") { setAddingTemplate(false); setNewTemplateDraft(""); }
                            }}
                            placeholder="New template text…"
                          />
                          <button type="button" onClick={addTemplate}>Save</button>
                          <button type="button" onClick={() => { setAddingTemplate(false); setNewTemplateDraft(""); }}>
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
                <div className="v2-inbox-composer-actions">
                  <button type="button" className="v2-primary-button" onClick={onSendMessage} disabled={!canSend}>
                    <Send size={16} />
                    {sending ? "Sending" : "Send"}
                  </button>
                  <button type="button" onClick={() => onNavigate("work")}>Open job</button>
                </div>
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
