import {
  ArrowRight,
  Bell,
  CheckCheck,
  Clock3,
  MessageCircle,
  MessageSquareText,
  Send,
  UserCheck,
} from "lucide-react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import "./inbox-center.css";

interface ActivityItem {
  id: number;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  kind?: "info" | "success" | "warning" | "error";
}

interface PaymentRecord {
  id: number;
  jobId: number;
  jobTitle: string;
  worker: string;
  amount: number;
  method: string;
  status: "Payment pending" | "Paid / Closed";
  date: string;
}

interface InboxCenterProps {
  jobs: Job[];
  sentMessages: string[];
  messageDraft: string;
  activityFeed: ActivityItem[];
  paymentRecords: PaymentRecord[];
  onMessageDraft: (message: string) => void;
  onSendMessage: () => void;
  onNavigate: (destination: PrimaryDestination) => void;
}

function InboxBadge({ value, label }: { value: number | string; label: string }) {
  return (
    <article className="v2-inbox-badge">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

export function InboxCenter({
  jobs,
  sentMessages,
  messageDraft,
  activityFeed,
  paymentRecords,
  onMessageDraft,
  onSendMessage,
  onNavigate,
}: InboxCenterProps) {
  const unreadItems = activityFeed.filter((item) => item.unread);
  const pendingPayments = paymentRecords.filter((record) => record.status === "Payment pending");
  const recentJobs = jobs.slice(0, 3);

  return (
    <section className="v2-inbox-page" aria-label="Inbox">
      <header className="v2-inbox-header">
        <div>
          <h1>Inbox</h1>
          <p>Messages, job activity, and payment follow-up in one place.</p>
        </div>
        <div className="v2-inbox-summary">
          <InboxBadge value={unreadItems.length} label="new updates" />
          <InboxBadge value={pendingPayments.length} label="pending payments" />
          <InboxBadge value={sentMessages.length} label="outbound notes" />
        </div>
      </header>

      <div className="v2-inbox-grid">
        <section className="v2-inbox-panel">
          <header>
            <div>
              <span>Quick send</span>
              <h2>Reply without leaving work</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Open work</button>
          </header>
          <div className="v2-inbox-composer">
            <label>
              <span>Message</span>
              <textarea
                value={messageDraft}
                onChange={(event) => onMessageDraft(event.target.value)}
                placeholder="Write a quick update, question, or follow-up."
              />
            </label>
            <div className="v2-inbox-composer-actions">
              <button type="button" className="v2-primary-button" onClick={onSendMessage}>
                <Send size={16} />
                Send
              </button>
              <button type="button" onClick={() => onNavigate("work")}>
                <MessageSquareText size={16} />
                Job context
              </button>
            </div>
          </div>
        </section>

        <section className="v2-inbox-panel">
          <header>
            <div>
              <span>Unread</span>
              <h2>What needs attention</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>View jobs</button>
          </header>
          <div className="v2-inbox-list">
            {unreadItems.length ? unreadItems.map((item) => (
              <article key={item.id} className={`v2-inbox-item ${item.kind ?? "info"}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <small>{item.timestamp}</small>
              </article>
            )) : (
              <article className="v2-inbox-empty">
                <Bell size={20} />
                <strong>No unread updates</strong>
                <span>You’re caught up right now.</span>
              </article>
            )}
          </div>
        </section>

        <section className="v2-inbox-panel">
          <header>
            <div>
              <span>Recent activity</span>
              <h2>Activity log</h2>
            </div>
            <button type="button" onClick={() => onNavigate("network")}>Open network</button>
          </header>
          <div className="v2-inbox-list">
            {activityFeed.slice(0, 4).map((item) => (
              <article key={item.id} className="v2-inbox-item">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <small>{item.timestamp}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="v2-inbox-panel">
          <header>
            <div>
              <span>Connected work</span>
              <h2>Jobs and follow-ups</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Open work</button>
          </header>
          <div className="v2-inbox-job-list">
            {recentJobs.map((job) => (
              <button key={job.id} type="button" className="v2-inbox-job-row" onClick={() => onNavigate("work")}>
                <span className="v2-inbox-job-icon"><UserCheck size={16} /></span>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.trade} · {job.location}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="v2-inbox-panel v2-inbox-panel-wide">
          <header>
            <div>
              <span>Sent messages</span>
              <h2>What you’ve already sent</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Open records</button>
          </header>
          <div className="v2-inbox-sent">
            {sentMessages.length ? sentMessages.map((message, index) => (
              <article key={`${message}-${index}`}>
                <MessageCircle size={16} />
                <span>{message}</span>
                <small><CheckCheck size={12} /> delivered</small>
              </article>
            )) : (
              <article className="v2-inbox-empty">
                <Clock3 size={20} />
                <strong>No messages sent yet</strong>
                <span>Send a quick reply to start the thread.</span>
              </article>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
