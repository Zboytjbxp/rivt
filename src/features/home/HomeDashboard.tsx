import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  FileText,
  MapPin,
  MessageSquareText,
  Plus,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import type { Job, Role } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { EmptyState, PageHeader } from "../../components/ui";
import "./home-dashboard.css";

type AvailabilityStatus = "available" | "limited" | "unavailable";

interface HomeDashboardProps {
  role: Role;
  name: string;
  location: string;
  activeJob: Job | null;
  upcomingJobs: Job[];
  applicationCount: number;
  unreadCount: number;
  pendingPaymentCount: number;
  communityCount: number;
  shoutOutCount: number;
  availabilityStatus: AvailabilityStatus;
  primaryTrade: string;
  newsCount: number;
  answerQueueCount: number;
  onPostJob: () => void;
  onOpenJob: (jobId: number) => void;
  onNavigate: (destination: PrimaryDestination) => void;
  onSetAvailability: (status: AvailabilityStatus) => Promise<void>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomeDashboard({
  role,
  name,
  location,
  activeJob,
  upcomingJobs,
  applicationCount,
  unreadCount,
  pendingPaymentCount,
  communityCount,
  shoutOutCount,
  availabilityStatus,
  primaryTrade,
  newsCount,
  answerQueueCount,
  onPostJob,
  onOpenJob,
  onNavigate,
  onSetAvailability,
}: HomeDashboardProps) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const [savingAvailability, setSavingAvailability] = useState<AvailabilityStatus | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const moneySignal = activeJob ? currency(activeJob.pay) : role === "contractor" ? "Post work" : `${upcomingJobs.length} matches`;
  const workSignal = role === "contractor"
    ? `${applicationCount || "No"} applicants`
    : `${upcomingJobs.length} jobs nearby`;
  const availabilityCopy = {
    available: role === "contractor" ? "Open to crew conversations" : "Shown as ready for work",
    limited: role === "contractor" ? "Some capacity today" : "Available with limits",
    unavailable: role === "contractor" ? "Booked for now" : "Hidden from quick-availability signals",
  } satisfies Record<AvailabilityStatus, string>;
  const availabilityOptions: Array<{ status: AvailabilityStatus; label: string; detail: string }> = [
    { status: "available", label: "Available", detail: role === "contractor" ? "Taking conversations" : "Ready for work" },
    { status: "limited", label: "Limited", detail: "Some openings" },
    { status: "unavailable", label: "Booked", detail: "Not looking today" },
  ];
  const dailySignals = [
    {
      label: role === "contractor" ? "Crew signal" : "Work signal",
      value: workSignal,
      detail: role === "contractor" ? "Review applicants or invite saved people" : "Check jobs that fit your trade and area",
      action: "Open Work",
      destination: "work" as PrimaryDestination,
    },
    {
      label: "Money signal",
      value: moneySignal,
      detail: pendingPaymentCount ? `${pendingPaymentCount} payment record${pendingPaymentCount === 1 ? "" : "s"} need review` : "Invoices and records are current",
      action: "Open Tools",
      destination: "tools" as PrimaryDestination,
    },
    {
      label: "Network signal",
      value: `${shoutOutCount} shout-outs`,
      detail: role === "contractor" ? "Keep reliable subs close" : "Build proof other contractors can trust",
      action: "Open Crew",
      destination: "crew" as PrimaryDestination,
    },
    {
      label: "Field signal",
      value: answerQueueCount ? `${answerQueueCount} need answers` : `${communityCount} posts`,
      detail: answerQueueCount
        ? `${primaryTrade} and General questions you can help close`
        : `${newsCount} trade updates plus questions in Shop Talk`,
      action: answerQueueCount ? "Answer" : "Read",
      destination: "shop-talk" as PrimaryDestination,
    },
  ];

  async function handleAvailability(status: AvailabilityStatus) {
    if (status === availabilityStatus || savingAvailability) return;
    setSavingAvailability(status);
    setAvailabilityMessage("");
    try {
      await onSetAvailability(status);
      setAvailabilityMessage("Availability saved to your profile.");
    } catch (error) {
      setAvailabilityMessage(error instanceof Error ? error.message : "Availability could not be saved.");
    } finally {
      setSavingAvailability(null);
    }
  }

  return (
    <section className="v2-home-page" aria-label="Home">
      <PageHeader
        className="v2-home-header"
        title={`Good morning, ${firstName}`}
        description={location}
        actions={role === "contractor" ? (
          <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post work</button>
        ) : (
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}><BriefcaseBusiness size={17} /> Find work</button>
        )}
      />

      <section className="v2-daily-brief" aria-label="RIVT Daily">
        <div className="v2-daily-brief-copy">
          <span>RIVT Daily</span>
          <h2>Make money, protect the record, and stay visible.</h2>
          <p>
            A morning check-in for work, crew, trade news, messages, and the tools that keep the job moving.
          </p>
        </div>
        <div className="v2-daily-signal-grid">
          {dailySignals.map((signal) => (
            <button type="button" key={signal.label} onClick={() => onNavigate(signal.destination)}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.detail}</small>
              <em>{signal.action} <ArrowRight size={13} /></em>
            </button>
          ))}
        </div>
      </section>

      <div className="v2-home-focus-grid">
        <article className="v2-today-panel">
          <header>
            <span>Today</span>
            <small>{activeJob ? activeJob.status : "No active job"}</small>
          </header>
          {activeJob ? (
            <>
              <div className="v2-today-job">
                <div>
                  <span>{activeJob.trade}</span>
                  <h2>{activeJob.title}</h2>
                  <p><MapPin size={14} /> {activeJob.location}</p>
                </div>
                <strong>{currency(activeJob.pay)}</strong>
              </div>
              <div className="v2-today-facts">
                <span><CalendarClock size={15} /> {activeJob.durationHours}h estimate</span>
                <span><Users size={15} /> {activeJob.applicants} interested</span>
                <span><Wrench size={15} /> {activeJob.tools.length} tools listed</span>
              </div>
              <div className="v2-today-actions">
                <button type="button" className="v2-primary-button" onClick={() => onOpenJob(activeJob.id)}>Open job <ArrowRight size={16} /></button>
                <button type="button" onClick={() => onNavigate("messages")}><MessageSquareText size={16} /> Message</button>
                <button type="button" onClick={() => onNavigate("tools")}><FileText size={16} /> Invoice</button>
              </div>
            </>
          ) : (
            <EmptyState
              className="v2-home-empty"
              icon={<BriefcaseBusiness size={24} />}
              title={role === "contractor" ? "Post your first job" : "Find your next job"}
              description={role === "contractor" ? "Describe the work and invite people from your network." : "Browse work that matches your trade and availability."}
            />
          )}
        </article>

        <div className="v2-home-side-stack">
          <aside className="v2-availability-radar">
            <header>
              <div>
                <span>Availability radar</span>
                <strong>{availabilityCopy[availabilityStatus]}</strong>
              </div>
              <small>{primaryTrade}</small>
            </header>
            <p>
              {role === "contractor"
                ? "Let nearby tradespeople know whether you are open to crew conversations and upcoming help."
                : "Set the signal contractors see before they message, invite, or save your profile."}
            </p>
            <div className="v2-availability-options" role="group" aria-label="Daily availability">
              {availabilityOptions.map((option) => (
                <button
                  key={option.status}
                  type="button"
                  className={availabilityStatus === option.status ? "active" : ""}
                  aria-pressed={availabilityStatus === option.status}
                  disabled={Boolean(savingAvailability)}
                  onClick={() => void handleAvailability(option.status)}
                >
                  <strong>{savingAvailability === option.status ? "Saving" : option.label}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            {availabilityMessage && <small className="v2-availability-message">{availabilityMessage}</small>}
          </aside>

          <aside className="v2-attention-panel">
            <header><span>Needs attention</span><button type="button" onClick={() => onNavigate("messages")}>Open messages</button></header>
            <button type="button" onClick={() => onNavigate("work")}>
              <span className="v2-attention-icon"><Users size={17} /></span>
              <span><strong>{applicationCount || "No"} {role === "contractor" ? "applicants" : "applications"}</strong><small>{applicationCount ? "Review the latest activity" : "Nothing waiting right now"}</small></span>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => onNavigate("messages")}>
              <span className="v2-attention-icon"><MessageSquareText size={17} /></span>
              <span><strong>{unreadCount || "No"} unread updates</strong><small>{unreadCount ? "Messages and job activity" : "You're caught up"}</small></span>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => onNavigate("tools")}>
              <span className="v2-attention-icon"><CircleDollarSign size={17} /></span>
              <span><strong>{pendingPaymentCount || "No"} pending payments</strong><small>{pendingPaymentCount ? "Review payment records" : "Payment log is current"}</small></span>
              <ArrowRight size={15} />
            </button>
          </aside>
        </div>
      </div>

      <div className="v2-home-secondary-grid">
        <section className="v2-next-work">
          <header><div><h2>Next work</h2><p>Jobs ready for a decision.</p></div><button type="button" onClick={() => onNavigate("work")}>View all</button></header>
          <div className="v2-next-work-list">
            {upcomingJobs.slice(0, 3).map((job) => (
              <button type="button" key={job.id} onClick={() => onOpenJob(job.id)}>
                <span><small>{job.trade} - {job.location}</small><strong>{job.title}</strong></span>
                <span><strong>{currency(job.pay)}</strong><small>{job.status}</small></span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="v2-network-pulse">
          <header><div><h2>Your crew</h2><p>People and field knowledge.</p></div><button type="button" onClick={() => onNavigate("crew")}>Open crew</button></header>
          <div>
            <button type="button" onClick={() => onNavigate("crew")}><Users size={18} /><span><strong>{shoutOutCount} shout-outs</strong><small>Peer reputation</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate("shop-talk")}><MessageSquareText size={18} /><span><strong>{communityCount} discussions</strong><small>Shop Talk</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate("tools")}><Wrench size={18} /><span><strong>Field tools</strong><small>Estimate, invoice, and records</small></span><ArrowRight size={15} /></button>
          </div>
        </section>
      </div>
    </section>
  );
}
