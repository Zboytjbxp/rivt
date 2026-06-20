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
import { useEffect, useRef, useState } from "react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { listActiveWork, type CanonicalActiveWork } from "../work/job-api";
import {
  addProjectNote,
  getProjectReport,
  openProjectForActiveWork,
  ProjectApiError,
  resolveProjectCompletion,
  submitProjectCompletion,
  uploadProjectMedia,
  type ProjectRecord,
} from "./project-api";
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
  mode?: "tools" | "records";
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenJob: (jobId: number) => void;
  onOpenRecords: () => void;
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

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not update the project record.";
}

export function ToolsStudio({ jobs, paymentRecords, mode = "tools", onNavigate, onOpenJob, onOpenRecords }: ToolsStudioProps) {
  const activeJob = jobs.find((job) => job.status !== "Paid / Closed") ?? jobs[0];
  const pendingPayments = paymentRecords.filter((record) => record.status === "Payment pending");
  const [activeWork, setActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectAction, setProjectAction] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCompletion = selectedProject?.completionSubmissions.find((completion) => completion.status === "submitted")
    ?? selectedProject?.completionSubmissions.at(-1)
    ?? null;

  useEffect(() => {
    let cancelled = false;
    listActiveWork()
      .then((items) => {
        if (cancelled) return;
        setActiveWork(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setRecordsError(error instanceof Error ? error.message : "Could not load active work.");
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOpenRecord(work: CanonicalActiveWork) {
    setProjectAction(`open:${work.id}`);
    setRecordsError(null);
    setReportPreview(null);
    try {
      setSelectedProject(await openProjectForActiveWork(work.id));
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function refreshSelectedProject() {
    const work = selectedProject ? activeWork.find((item) => item.id === selectedProject.activeWorkId) : null;
    if (work) setSelectedProject(await openProjectForActiveWork(work.id));
  }

  async function handleAddNote() {
    if (!selectedProject) return;
    const body = window.prompt("Add a private project note");
    if (!body?.trim()) return;
    setProjectAction("note");
    setRecordsError(null);
    try {
      await addProjectNote(selectedProject.id, body.trim());
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleFileSelected(file: File | null) {
    if (!selectedProject || !file) return;
    setProjectAction("upload");
    setRecordsError(null);
    try {
      await uploadProjectMedia(selectedProject.id, file, "Uploaded from RIVT Records.");
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmitCompletion() {
    if (!selectedProject) return;
    const note = window.prompt("Completion note for the contractor");
    if (!note?.trim()) return;
    setProjectAction("submit");
    setRecordsError(null);
    try {
      await submitProjectCompletion(
        selectedProject.id,
        note.trim(),
        selectedProject.media.filter((item) => item.status === "stored").map((item) => item.id),
      );
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleResolveCompletion(decision: "confirm" | "dispute") {
    if (!selectedProject || !selectedCompletion) return;
    const reason = window.prompt(decision === "confirm" ? "Confirmation note" : "Why are you disputing completion?") ?? "";
    if (decision === "dispute" && !reason.trim()) return;
    setProjectAction(decision);
    setRecordsError(null);
    try {
      await resolveProjectCompletion(selectedProject.id, selectedCompletion.id, decision, reason.trim());
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleLoadReport() {
    if (!selectedProject) return;
    setProjectAction("report");
    setRecordsError(null);
    try {
      const report = await getProjectReport(selectedProject.id);
      setReportPreview(JSON.stringify(report, null, 2));
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  if (mode === "records") {
    return (
      <section className="v2-tools-page" aria-label="Project records">
        <header className="v2-tools-header">
          <div>
            <h1>Records</h1>
            <p>Private closeout packets for accepted work. Photos, notes, completion, and reports are server-backed.</p>
          </div>
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}>
            <FolderOpen size={16} />
            Open work
          </button>
        </header>

        {recordsError ? <p className="v2-record-error" role="alert">{recordsError}</p> : null}

        <div className="v2-records-layout">
          <section className="v2-tools-panel">
            <header>
              <div>
                <span>Accepted work</span>
                <h2>{recordsLoading ? "Loading records..." : `${activeWork.length} private record${activeWork.length === 1 ? "" : "s"}`}</h2>
              </div>
              <button type="button" onClick={() => onNavigate("work")}>Find work</button>
            </header>
            {activeWork.length ? (
              <div className="v2-record-work-list">
                {activeWork.map((work) => (
                  <button key={work.id} type="button" className="v2-record-work-item" onClick={() => void handleOpenRecord(work)} disabled={Boolean(projectAction)}>
                    <span>
                      <strong>{work.job?.title ?? `Work ${work.id.slice(0, 8)}`}</strong>
                      <small>{work.job?.publicLocation.city ?? "Project"} · {work.status}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <article className="v2-tools-empty">
                <FolderOpen size={20} />
                <strong>No accepted work yet</strong>
                <span>Records unlock after a contractor and tradesperson both accept the work.</span>
              </article>
            )}
          </section>

          <section className="v2-tools-panel v2-record-detail-panel">
            {selectedProject ? (
              <>
                <header>
                  <div>
                    <span>{selectedProject.status.replaceAll("_", " ")}</span>
                    <h2>{selectedProject.job.title}</h2>
                  </div>
                  <button type="button" onClick={() => void handleLoadReport()} disabled={Boolean(projectAction)}>Report</button>
                </header>
                <div className="v2-record-metrics">
                  <article><strong>{selectedProject.entries.length}</strong><span>timeline entries</span></article>
                  <article><strong>{selectedProject.media.filter((item) => item.status === "stored").length}</strong><span>stored files</span></article>
                  <article><strong>{selectedProject.completionSubmissions.length}</strong><span>completion submits</span></article>
                </div>
                <div className="v2-record-actions">
                  <button type="button" onClick={() => void handleAddNote()} disabled={Boolean(projectAction)}>Add note</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(projectAction)}>Upload evidence</button>
                  <button type="button" onClick={() => void handleSubmitCompletion()} disabled={Boolean(projectAction)}>Submit completion</button>
                  {selectedCompletion?.status === "submitted" ? (
                    <>
                      <button type="button" className="v2-primary-button" onClick={() => void handleResolveCompletion("confirm")} disabled={Boolean(projectAction)}>Confirm</button>
                      <button type="button" className="v2-destructive-button" onClick={() => void handleResolveCompletion("dispute")} disabled={Boolean(projectAction)}>Dispute</button>
                    </>
                  ) : null}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,text/plain" hidden onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)} />
                </div>
                <ol className="v2-record-timeline">
                  {selectedProject.entries.slice().reverse().map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.entryType.replaceAll("_", " ")}</strong>
                      <span>{entry.body || "Record updated"}</span>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </li>
                  ))}
                </ol>
                {reportPreview ? <pre className="v2-record-report">{reportPreview}</pre> : null}
              </>
            ) : (
              <article className="v2-tools-empty">
                <FileText size={20} />
                <strong>Select an accepted job</strong>
                <span>Open a record to add closeout evidence, submit completion, or generate the closeout report.</span>
              </article>
            )}
          </section>
        </div>
      </section>
    );
  }

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
            <ToolCard icon={FolderOpen} title="Records" summary="Completion packets, payment logs, and exportable history." action="Open records" onAction={onOpenRecords} />
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
            <button type="button" onClick={onOpenRecords}>Open records</button>
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
              <strong>{activeWork.filter((work) => work.status === "active").length}</strong>
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
