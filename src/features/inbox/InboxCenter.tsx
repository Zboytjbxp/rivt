import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock3,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  VolumeX,
} from "lucide-react";
import type { PrimaryDestination } from "../../app-shell/types";
import type { InboxConversation, InboxMessage, InboxNotification } from "./inbox-api";
import { EmptyState, MetricTile, PageHeader, Panel } from "../../components/ui";
import "./inbox-center.css";

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
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const unreadThreads = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const otherParticipants = selectedConversation?.participants.filter((participant) => participant.accountId !== accountId) ?? [];
  const canSend = Boolean(selectedConversation && messageDraft.trim() && !sending);

  return (
    <section className="v2-inbox-page" aria-label="Inbox">
      <PageHeader
        className="v2-inbox-header"
        title="Inbox"
        description="Server-owned job messages and notifications for accepted work."
        actions={
        <div className="v2-inbox-summary">
          <MetricTile value={unreadThreads} label="unread messages" />
          <MetricTile value={unreadNotifications.length} label="new updates" />
          <MetricTile value={conversations.length} label="work threads" />
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
        <Panel
          className="v2-inbox-panel"
          eyebrow="Threads"
          title="Accepted work only"
          action={<button type="button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>}
        >
          <div className="v2-inbox-thread-list">
            {loading ? (
              <EmptyState className="v2-inbox-empty" icon={<Clock3 size={20} />} title="Loading threads" description="Checking active work conversations." compact />
            ) : conversations.length ? conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === selectedConversationId ? "v2-inbox-thread is-active" : "v2-inbox-thread"}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span>
                  <strong>{conversation.job.title}</strong>
                  <small>{conversation.job.publicLocation.city}, {conversation.job.publicLocation.region}</small>
                </span>
                {conversation.unreadCount > 0 ? <b>{conversation.unreadCount}</b> : null}
                <em>{conversation.lastMessage ? timeLabel(conversation.lastMessage.createdAt) : "new"}</em>
              </button>
            )) : (
              <EmptyState
                className="v2-inbox-empty"
                icon={<MessageCircle size={20} />}
                title="No work threads yet"
                description="A thread opens after a contractor offer is accepted."
                action={<button type="button" onClick={() => onNavigate("work")}>Open Work</button>}
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-inbox-panel v2-inbox-panel-thread"
          eyebrow="Conversation"
          title={selectedConversation ? selectedConversation.job.title : "Select a thread"}
          action={selectedConversation ? (
              <div className="v2-inbox-header-actions">
                <button type="button" onClick={onMarkSelectedRead}><CheckCheck size={14} /> Read</button>
                <button type="button" onClick={onMuteSelected}><VolumeX size={14} /> Mute</button>
                <button type="button" onClick={onReportSelected}><ShieldAlert size={14} /> Report</button>
              </div>
          ) : null}
        >

          {selectedConversation ? (
            <>
              <div className="v2-inbox-context">
                <strong>{selectedConversation.job.organization.name}</strong>
                <span>{selectedConversation.job.publicLocation.city}, {selectedConversation.job.publicLocation.region}</span>
                <small>{otherParticipants.map((participant) => participant.displayName).join(", ") || "Work participant"}</small>
              </div>
              <div className="v2-inbox-message-list">
                {messages.length ? messages.map((message) => {
                  const mine = message.senderAccountId === accountId;
                  const state = messageState(message, accountId);
                  return (
                    <article key={message.id} className={mine ? "v2-inbox-message is-mine" : "v2-inbox-message"}>
                      <small>{message.sender?.displayName || "RIVT member"} - {timeLabel(message.createdAt)}</small>
                      <p>{message.body}</p>
                      {state ? <span><CheckCheck size={12} /> {state}</span> : null}
                    </article>
                  );
                }) : (
                  <EmptyState className="v2-inbox-empty" icon={<Clock3 size={20} />} title="No messages yet" description="Send the first update when you have a real work question." compact />
                )}
              </div>
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
            <EmptyState className="v2-inbox-empty v2-inbox-empty-large" icon={<MessageCircle size={24} />} title="Select a work thread" description="Messages are only available between accepted work participants." />
          )}
        </Panel>

        <Panel
          className="v2-inbox-panel v2-inbox-panel-wide"
          eyebrow="Notifications"
          title="What changed since you last checked"
          action={<button type="button" onClick={onMarkNotificationsRead} disabled={!unreadNotifications.length}>
              <Bell size={14} />
              Mark all read
            </button>}
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
              <EmptyState className="v2-inbox-empty" icon={<Bell size={20} />} title="No notifications yet" description="Offers, accepted work, and new messages will show here." compact />
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}
