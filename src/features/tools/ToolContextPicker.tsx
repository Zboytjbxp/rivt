import { BriefcaseBusiness, Check, ChevronDown, Plus, Unlink } from "lucide-react";
import { useState } from "react";
import type { CanonicalActiveWork } from "../work/job-api";
import type { StandaloneProject } from "./standalone-project-api";
import { toolContextEyebrow, toolContextLabel, type ToolWorkContext } from "./tool-work-context";

export function ToolContextPicker({
  context,
  standaloneProjects,
  activeWork,
  busy,
  error,
  onChooseQuick,
  onChooseStandalone,
  onChooseActiveWork,
  onCreateStandalone,
  openRequestToken,
  hideTrigger = false,
  allowQuickUse = true,
}: {
  context: ToolWorkContext;
  standaloneProjects: StandaloneProject[];
  activeWork: CanonicalActiveWork[];
  busy: boolean;
  error: string;
  onChooseQuick: () => void;
  onChooseStandalone: (project: StandaloneProject) => void;
  onChooseActiveWork: (work: CanonicalActiveWork) => void;
  onCreateStandalone: (input: { title: string; clientName: string; locationText: string }) => Promise<boolean>;
  openRequestToken?: number;
  hideTrigger?: boolean;
  allowQuickUse?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [dismissedRequestToken, setDismissedRequestToken] = useState(0);
  const requestedOpen = Boolean(openRequestToken && openRequestToken !== dismissedRequestToken);
  const isOpen = open || requestedOpen;

  function closePicker() {
    setOpen(false);
    setDismissedRequestToken(openRequestToken ?? 0);
  }

  async function createProject() {
    if (!title.trim()) return;
    const created = await onCreateStandalone({ title: title.trim(), clientName: clientName.trim(), locationText: locationText.trim() });
    if (!created) return;
    setTitle("");
    setClientName("");
    setLocationText("");
    setCreating(false);
    closePicker();
  }

  return (
    <>
      {!hideTrigger ? (
        <button type="button" className="v2-tool-context-trigger" onClick={() => setOpen(true)} aria-label={`Work context: ${toolContextLabel(context)}. Change context.`}>
          <span><small>{toolContextEyebrow(context)}</small><strong>{toolContextLabel(context)}</strong></span>
          <ChevronDown size={18} />
        </button>
      ) : null}
      {isOpen ? (
        <div className="v2-tool-context-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closePicker(); }}>
          <section className="v2-tool-context-sheet" role="dialog" aria-modal="true" aria-labelledby="tool-context-title">
            <header>
              <div><small>Save destination</small><h2 id="tool-context-title">Choose work context</h2></div>
              <button type="button" onClick={closePicker} aria-label="Close work context">Close</button>
            </header>
            <p>Use the tool by itself, keep off-platform work together, or connect it to accepted RIVT work.</p>
            {allowQuickUse ? (
              <button type="button" className="v2-tool-context-option" onClick={() => { onChooseQuick(); closePicker(); }}>
                <Unlink size={19} /><span><strong>Quick use</strong><small>No project required</small></span>{context.kind === "quick" ? <Check size={18} /> : null}
              </button>
            ) : null}
            <div className="v2-tool-context-group">
              <div className="v2-tool-context-group-title"><span>Standalone projects</span><button type="button" onClick={() => setCreating((current) => !current)}><Plus size={16} />New</button></div>
              {creating ? (
                <div className="v2-tool-context-create">
                  <label>Project name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Miller kitchen" autoFocus /></label>
                  <label>Client <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Optional" /></label>
                  <label>Location <input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Optional" /></label>
                  <button type="button" className="v2-primary-button" disabled={busy || !title.trim()} onClick={() => void createProject()}>{busy ? "Creating..." : "Create project"}</button>
                </div>
              ) : null}
              {standaloneProjects.filter((project) => project.status === "active").map((project) => (
                <button type="button" className="v2-tool-context-option" key={project.id} onClick={() => { onChooseStandalone(project); closePicker(); }}>
                  <BriefcaseBusiness size={19} /><span><strong>{project.title}</strong><small>{project.clientName || project.locationText || "Private off-platform work"}</small></span>{context.kind === "standalone" && context.project.id === project.id ? <Check size={18} /> : null}
                </button>
              ))}
            </div>
            {activeWork.length ? (
              <div className="v2-tool-context-group">
                <div className="v2-tool-context-group-title"><span>Accepted RIVT work</span></div>
                {activeWork.map((work) => (
                  <button type="button" className="v2-tool-context-option" key={work.id} onClick={() => { onChooseActiveWork(work); closePicker(); }}>
                    <BriefcaseBusiness size={19} /><span><strong>{work.job?.title ?? "Accepted work"}</strong><small>{work.job?.publicLocation.city ?? "RIVT workspace"}</small></span>{context.kind === "rivt" && context.activeWorkId === work.id ? <Check size={18} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="v2-record-error" role="alert">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
