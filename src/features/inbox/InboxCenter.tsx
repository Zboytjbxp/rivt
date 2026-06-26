import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCheck,
  Clock3,
  MessageCircle,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  VolumeX,
  X,
} from "lucide-react";
import type { PrimaryDestination } from "../../app-shell/types";
import type { InboxConversation, InboxMessage, InboxNotification } from "./inbox-api";
import { EmptyState, MetricTile, PageHeader, Panel, SkeletonCard } from "../../components/ui";
import "./inbox-center.css";

// ─── localStorage keys ────────────────────────────────────────────────────────
const TEMPLATES_KEY = "rivt.msgTemplates.v1";
const PINNED_KEY = "rivt.pinnedConvs.v1";
const ARCHIVED_KEY = "rivt.archivedConvs.v1";
const REACTIONS_KEY = "rivt.msgReactions.v1";

const DEFAULT_TEMPLATES = [
  "Available and interested — can you share more details?",
  "What's the address / site location?",
  "My rate is $75/hr. Does that work for you?",
  "I'm booked this week but available next week.",
  "Can you send over the full scope of work?",
];

const EMOJI_OPTIONS = ["👍", "👎", "🔥", "✅", "❓", "😂"];

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
}: InboxCenterProps) {
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="v2-inbox-page" aria-label="Inbox">
      <PageHeader
        className="v2-inbox-header"
        title="Inbox"
        description="Server-owned job messages and notifications for accepted work."
        actions={
          <div className="v2-inbox-summary">
            <MetricTile icon={<MessageCircle size={18} />} value={unreadThreads} label="unread messages" />
            <MetricTile icon={<Bell size={18} />} value={unreadNotifications.length} label="new updates" />
            <MetricTile icon={<Clock3 size={18} />} value={conversations.length} label="work threads" />
          </div>
        }
      />

      {error ? (
        <article className="v2-inbox-alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Retry</button>
        </article>
      ) : null}

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
                          <button
                            type="button"
                            className="v2-msg-reaction-pill"
                            onClick={(e) => { e.stopPropagation(); setReaction(message.id, existingReaction); }}
                            title="Remove reaction"
                          >
                            {existingReaction}
                          </button>
                        )}
                        <button
                          type="button"
                          className="v2-msg-reaction-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReactionPickerFor(pickerOpen ? null : message.id);
                          }}
                          title="React"
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
              <article key={item.id} className={item.readAt ? "v2-inbox-item" : "v2-inbox-item unread"}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
                <small>{timeLabel(item.createdAt)}</small>
              </article>
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
