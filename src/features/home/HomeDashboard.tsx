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
import type { Job, Role } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import "./home-dashboard.css";

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
  onPostJob: () => void;
  onOpenJob: (jobId: number) => void;
  onNavigate: (destination: PrimaryDestination) => void;
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
  onPostJob,
  onOpenJob,
  onNavigate,
}: HomeDashboardProps) {
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return (
    <section className="v2-home-page" aria-label="Home">
      <header className="v2-home-header">
        <div>
          <h1>Good morning, {firstName}</h1>
          <p>{location}</p>
        </div>
        {role === "contractor" ? (
          <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post work</button>
        ) : (
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}><BriefcaseBusiness size={17} /> Find work</button>
        )}
      </header>

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
            <div className="v2-home-empty">
              <BriefcaseBusiness size={24} />
              <h2>{role === "contractor" ? "Post your first job" : "Find your next job"}</h2>
              <p>{role === "contractor" ? "Describe the work and invite people from your network." : "Browse work that matches your trade and availability."}</p>
            </div>
          )}
        </article>

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

      <div className="v2-home-secondary-grid">
        <section className="v2-next-work">
          <header><div><h2>Next work</h2><p>Jobs ready for a decision.</p></div><button type="button" onClick={() => onNavigate("work")}>View all</button></header>
          <div className="v2-next-work-list">
            {upcomingJobs.slice(0, 3).map((job) => (
              <button type="button" key={job.id} onClick={() => onOpenJob(job.id)}>
                <span><small>{job.trade} · {job.location}</small><strong>{job.title}</strong></span>
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
