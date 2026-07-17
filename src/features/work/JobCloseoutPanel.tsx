import { useMemo, useState } from "react";
import { Camera, CheckCircle2, ClipboardCheck, FileText, X } from "lucide-react";
import { useFocusTrap } from "../../app-shell/useFocusTrap";
import type { Role } from "../../types";
import {
  getProjectForActiveWork,
  resolveProjectCompletion,
  submitProjectCompletion,
  type ProjectRecord,
} from "../tools/project-api";

interface JobCloseoutPanelProps {
  open: boolean;
  role: Role;
  project: ProjectRecord;
  onClose: () => void;
  onOpenPhotos: () => void;
  onProjectChange: (project: ProjectRecord) => void;
  onLifecycleChange?: () => void;
}

function latestCompletion(project: ProjectRecord) {
  return [...project.completionSubmissions]
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt))[0] ?? null;
}

function projectErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The closeout could not be updated.";
}

export function JobCloseoutPanel({
  open,
  role,
  project,
  onClose,
  onOpenPhotos,
  onProjectChange,
  onLifecycleChange,
}: JobCloseoutPanelProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose, open);
  const completion = useMemo(() => latestCompletion(project), [project]);
  const [summary, setSummary] = useState(() => completion?.status === "disputed" ? completion.note : "");
  const [completedOnTime, setCompletedOnTime] = useState(true);
  const [clientApproved, setClientApproved] = useState(false);
  const [resolutionReason, setResolutionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storedMedia = project.media.filter((item) => item.status === "stored" && item.reviewStatus !== "rejected");
  const isTradesperson = role === "tradesperson";
  const canSubmit = isTradesperson && ["open", "disputed"].includes(project.status) && summary.trim().length > 0;
  const canReview = role === "contractor" && completion?.status === "submitted";

  async function refreshProject(message: string) {
    const refreshed = await getProjectForActiveWork(project.activeWorkId);
    onProjectChange(refreshed);
    onLifecycleChange?.();
    setNotice(message);
  }

  async function submitCompletion() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await submitProjectCompletion(
        project.id,
        summary.trim(),
        storedMedia.map((item) => item.id),
        { completedOnTime, clientApproved, photosProvided: storedMedia.length > 0 },
      );
      await refreshProject("Completion sent to the contractor for review.");
    } catch (cause) {
      setError(projectErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(decision: "confirm" | "dispute") {
    if (!completion || !canReview) return;
    if (decision === "dispute" && !resolutionReason.trim()) {
      setError("Describe what needs to change before sending the request.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resolveProjectCompletion(project.id, completion.id, decision, resolutionReason.trim());
      await refreshProject(decision === "confirm" ? "Work confirmed. This job is complete." : "Changes requested from the tradesperson.");
    } catch (cause) {
      setError(projectErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="v2-closeout-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={trapRef} className="v2-closeout-sheet" role="dialog" aria-modal="true" aria-labelledby="job-closeout-title">
        <header>
          <div>
            <span>Job closeout</span>
            <h2 id="job-closeout-title">{project.job.title}</h2>
          </div>
          <button type="button" className="v2-icon-button" onClick={onClose} aria-label="Close job closeout"><X size={20} /></button>
        </header>

        <div className="v2-closeout-body">
          {notice ? <p className="v2-closeout-notice" role="status">{notice}</p> : null}
          {error ? <p className="v2-closeout-error" role="alert">{error}</p> : null}

          {isTradesperson && ["open", "disputed"].includes(project.status) ? (
            <>
              {project.status === "disputed" && completion?.resolutions.at(-1)?.reason ? (
                <div className="v2-closeout-request"><strong>Contractor requested changes</strong><p>{completion.resolutions.at(-1)?.reason}</p></div>
              ) : null}
              <section className="v2-closeout-section">
                <div className="v2-closeout-section-heading"><ClipboardCheck size={19} /><div><strong>Tell the contractor what was completed</strong><span>A short summary is the only required closeout field.</span></div></div>
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} placeholder="Example: Replaced the GFCI, tested the circuit, and cleaned the work area." />
                {!summary.trim() ? <small className="v2-closeout-helper">Add a short completion summary to enable Submit completion.</small> : null}
              </section>

              <section className="v2-closeout-section is-optional">
                <div className="v2-closeout-section-heading"><Camera size={19} /><div><strong>Photos and proof</strong><span>Optional, but useful if the work needs visual documentation.</span></div></div>
                <button type="button" className="v2-secondary-button" onClick={onOpenPhotos}><Camera size={17} />{storedMedia.length ? `${storedMedia.length} photo/file${storedMedia.length === 1 ? "" : "s"} attached` : "Add photos"}</button>
              </section>

              <details className="v2-closeout-checks">
                <summary>Optional completion checks</summary>
                <label><input type="checkbox" checked={completedOnTime} onChange={(event) => setCompletedOnTime(event.target.checked)} />Completed on schedule</label>
                <label><input type="checkbox" checked={clientApproved} onChange={(event) => setClientApproved(event.target.checked)} />Contractor or client approved on site</label>
              </details>
            </>
          ) : completion ? (
            <section className="v2-closeout-review">
              <div className="v2-closeout-section-heading"><FileText size={19} /><div><strong>{completion.status === "confirmed" ? "Completion confirmed" : completion.status === "disputed" ? "Changes requested" : "Completion submitted"}</strong><span>{new Date(completion.submittedAt).toLocaleString()}</span></div></div>
              <blockquote>{completion.note}</blockquote>
              <p><Camera size={16} /> {completion.evidenceMediaIds.length} attached photo/file{completion.evidenceMediaIds.length === 1 ? "" : "s"}</p>
              {canReview ? (
                <>
                  <label className="v2-closeout-resolution"><span>Request changes (only if needed)</span><textarea value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} rows={3} placeholder="Describe what needs to be corrected or documented." /></label>
                  <div className="v2-closeout-review-actions">
                    <button type="button" className="v2-secondary-button" disabled={busy || !resolutionReason.trim()} onClick={() => void resolve("dispute")}>Request changes</button>
                    <button type="button" className="v2-primary-button" disabled={busy} onClick={() => void resolve("confirm")}><CheckCircle2 size={17} />Confirm complete</button>
                  </div>
                </>
              ) : null}
            </section>
          ) : (
            <p className="v2-closeout-empty">The tradesperson has not submitted completion yet.</p>
          )}
        </div>

        {isTradesperson && ["open", "disputed"].includes(project.status) ? (
          <footer>
            <button type="button" className="v2-primary-button" disabled={busy || !canSubmit} onClick={() => void submitCompletion()}><ClipboardCheck size={17} />{project.status === "disputed" ? "Send updated completion" : "Submit completion"}</button>
            {!summary.trim() ? <small>Add the completion summary above to continue.</small> : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
