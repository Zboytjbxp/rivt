import {
  ArrowRight,
  Calculator,
  FileText,
  FolderOpen,
  Plus,
  ReceiptText,
  Ruler,
  Scale,
  Wrench,
} from "lucide-react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import "./tools-studio.css";

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

interface ToolsStudioProps {
  jobs: Job[];
  paymentRecords: PaymentRecord[];
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenJob: (jobId: number) => void;
}

function ToolCard({
  icon: Icon,
  title,
  summary,
  action,
  onAction,
}: {
  icon: typeof Calculator;
  title: string;
  summary: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <article className="v2-tool-card">
      <div className="v2-tool-card-icon"><Icon size={18} /></div>
      <div>
        <strong>{title}</strong>
        <p>{summary}</p>
      </div>
      <button type="button" onClick={onAction}>
        {action}
        <ArrowRight size={14} />
      </button>
    </article>
  );
}

export function ToolsStudio({ jobs, paymentRecords, onNavigate, onOpenJob }: ToolsStudioProps) {
  const activeJob = jobs.find((job) => job.status !== "Paid / Closed") ?? jobs[0];
  const pendingPayments = paymentRecords.filter((record) => record.status === "Payment pending");

  return (
    <section className="v2-tools-page" aria-label="Tools">
      <header className="v2-tools-header">
        <div>
          <h1>Tools</h1>
          <p>Calculators and records that stay useful even when the board is quiet.</p>
        </div>
        <button type="button" className="v2-primary-button" onClick={() => activeJob && onOpenJob(activeJob.id)}>
          <Wrench size={16} />
          Use active job
        </button>
      </header>

      <div className="v2-tools-grid">
        <section className="v2-tools-panel">
          <header>
            <div>
              <span>Utility apps</span>
              <h2>Each tool can stand on its own</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Open work</button>
          </header>
          <div className="v2-tools-list">
            <ToolCard icon={Calculator} title="Calculator" summary="Fraction math, quick takeoffs, and field ratios." action="Open calculator" onAction={() => onOpenJob(activeJob?.id ?? jobs[0]?.id ?? 0)} />
            <ToolCard icon={Scale} title="Estimate" summary="Work through quantities and labor assumptions." action="Open estimate" onAction={() => onNavigate("work")} />
            <ToolCard icon={ReceiptText} title="Invoice" summary="Draft a clean invoice from the job you are already on." action="Open invoice" onAction={() => onNavigate("tools")} />
            <ToolCard icon={FolderOpen} title="Records" summary="Completion packets, payment logs, and exportable history." action="Open records" onAction={() => onNavigate("work")} />
          </div>
        </section>

        <section className="v2-tools-panel">
          <header>
            <div>
              <span>Active job tools</span>
              <h2>Ready when a job is selected</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Open job</button>
          </header>
          {activeJob ? (
            <article className="v2-tools-active-job">
              <span>{activeJob.trade}</span>
              <strong>{activeJob.title}</strong>
              <p>{activeJob.location} · {activeJob.workType}</p>
              <div className="v2-tools-active-job-actions">
                <button type="button" onClick={() => onOpenJob(activeJob.id)}>
                  <Plus size={15} />
                  Open details
                </button>
                <button type="button" onClick={() => onNavigate("tools")}>
                  <FileText size={15} />
                  Write invoice
                </button>
              </div>
            </article>
          ) : (
            <article className="v2-tools-empty">
              <Ruler size={20} />
              <strong>No active job selected</strong>
              <span>Select a job from Work and these tools can prefill from the scope.</span>
            </article>
          )}
        </section>

        <section className="v2-tools-panel">
          <header>
            <div>
              <span>Payment records</span>
              <h2>What still needs attention</h2>
            </div>
            <button type="button" onClick={() => onNavigate("tools")}>Open records</button>
          </header>
          <div className="v2-tools-records">
            <article>
              <strong>{paymentRecords.length}</strong>
              <span>logged payments</span>
            </article>
            <article>
              <strong>{pendingPayments.length}</strong>
              <span>waiting to close</span>
            </article>
            <article>
              <strong>{jobs.filter((job) => job.status === "Completion Pending").length}</strong>
              <span>completion packets due</span>
            </article>
          </div>
        </section>

        <section className="v2-tools-panel v2-tools-panel-wide">
          <header>
            <div>
              <span>Quick access</span>
              <h2>Jump into a workflow</h2>
            </div>
            <button type="button" onClick={() => onNavigate("crew")}>Open crew</button>
          </header>
          <div className="v2-tools-shortcuts">
            {jobs.slice(0, 3).map((job) => (
              <button key={job.id} type="button" className="v2-tools-shortcut" onClick={() => onOpenJob(job.id)}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.trade} · {job.status}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
