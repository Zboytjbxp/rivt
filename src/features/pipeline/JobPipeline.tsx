import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import "./job-pipeline.css";

const STAGES = ["Lead", "Quoted", "Active", "Invoiced", "Paid"] as const;
type Stage = (typeof STAGES)[number];

interface StoredJob {
  id: string;
  title: string;
  location?: string;
  status?: string;
  trade?: string;
  bidTotal?: number;
  startDate?: string;
}

function getStage(status?: string): Stage {
  const s = (status || "active").toLowerCase();
  if (s === "lead") return "Lead";
  if (s === "quoted") return "Quoted";
  if (s === "invoiced") return "Invoiced";
  if (s === "paid" || s === "completed") return "Paid";
  return "Active";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

interface JobPipelineProps {
  onClose: () => void;
}

export function JobPipeline({ onClose }: JobPipelineProps) {
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rivt.jobs.v1");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredJob[];
        if (Array.isArray(parsed)) setJobs(parsed);
      }
    } catch {}
  }, []);

  const jobsByStage: Record<Stage, StoredJob[]> = {
    Lead: [],
    Quoted: [],
    Active: [],
    Invoiced: [],
    Paid: [],
  };
  for (const job of jobs) {
    jobsByStage[getStage(job.status)].push(job);
  }

  const moveJob = (jobId: string, newStage: Stage) => {
    const statusMap: Record<Stage, string> = {
      Lead: "lead",
      Quoted: "quoted",
      Active: "active",
      Invoiced: "invoiced",
      Paid: "paid",
    };
    const all = (() => {
      try {
        const raw = localStorage.getItem("rivt.jobs.v1");
        return raw ? (JSON.parse(raw) as StoredJob[]) : [];
      } catch {
        return [];
      }
    })();
    const updated = all.map((j) =>
      j.id === jobId ? { ...j, status: statusMap[newStage] } : j
    );
    localStorage.setItem("rivt.jobs.v1", JSON.stringify(updated));
    setJobs(updated);
    setActionJobId(null);
  };

  const stageClass: Record<Stage, string> = {
    Lead: "stage-lead",
    Quoted: "stage-quoted",
    Active: "stage-active",
    Invoiced: "stage-invoiced",
    Paid: "stage-paid",
  };

  return (
    <div className="v2-pipeline-overlay" role="dialog" aria-modal="true" aria-label="Job Pipeline">
      <header className="v2-pipeline-header">
        <button
          type="button"
          className="v2-pipeline-back"
          onClick={onClose}
          aria-label="Close pipeline"
        >
          <ArrowLeft size={16} /> Pipeline
        </button>
        <span className="v2-pipeline-heading">Job Pipeline</span>
        <span className="v2-pipeline-subtitle">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </span>
      </header>

      <div className="v2-pipeline-body">
        {STAGES.map((stage, stageIndex) => {
          const stageJobs = jobsByStage[stage];
          const stageTotal = stageJobs.reduce(
            (sum, j) => sum + (j.bidTotal ?? 0),
            0
          );
          const hasValues = stageJobs.some((j) => (j.bidTotal ?? 0) > 0);
          const prevStage = stageIndex > 0 ? STAGES[stageIndex - 1] : null;
          const nextStage = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;

          return (
            <div key={stage} className="v2-pipeline-col">
              <div className={`v2-pipeline-col-header ${stageClass[stage]}`}>
                <span className="v2-pipeline-stage-name">{stage}</span>
                <span className="v2-pipeline-stage-count">{stageJobs.length}</span>
                {hasValues && (
                  <span className="v2-pipeline-stage-value">
                    {money(stageTotal)} pipeline
                  </span>
                )}
              </div>

              {stageJobs.length === 0 ? (
                <p className="v2-pipeline-empty">No jobs</p>
              ) : (
                stageJobs.map((job) => {
                  const isExpanded = actionJobId === job.id;
                  return (
                    <div
                      key={job.id}
                      className={`v2-pipeline-card${isExpanded ? " is-active" : ""}`}
                      onClick={() =>
                        setActionJobId(isExpanded ? null : job.id)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActionJobId(isExpanded ? null : job.id);
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div className="v2-pipeline-card-title">{job.title}</div>
                      <div className="v2-pipeline-card-meta">
                        {job.location && <span>📍 {job.location}</span>}
                        {job.trade && <span>⚡ {job.trade}</span>}
                        {job.bidTotal && job.bidTotal > 0 ? (
                          <span>{money(job.bidTotal)}</span>
                        ) : null}
                      </div>

                      {isExpanded && (
                        <div
                          className="v2-pipeline-card-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="v2-pipeline-move-btn"
                            disabled={!prevStage}
                            onClick={() => {
                              if (prevStage) moveJob(job.id, prevStage);
                            }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            className="v2-pipeline-move-btn v2-pipeline-move-fwd"
                            disabled={!nextStage}
                            onClick={() => {
                              if (nextStage) moveJob(job.id, nextStage);
                            }}
                          >
                            Forward →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
