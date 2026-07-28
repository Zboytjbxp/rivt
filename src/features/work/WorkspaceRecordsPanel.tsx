import { useEffect, useMemo, useState } from "react";
import { Check, DollarSign, ListTodo, Pencil, Plus, RefreshCw, RotateCcw, StickyNote, Trash2, X } from "lucide-react";
import {
  WorkspaceRecordsApiError,
  archiveWorkspaceRecord,
  createWorkspaceRecord,
  listWorkspaceRecords,
  restoreWorkspaceRecord,
  updateWorkspaceRecord,
  type WorkspaceRecord,
  type WorkspaceRecordEvent,
  type WorkspaceRecordState,
  type WorkspaceRecordType,
  type WorkspaceRecordVisibility,
} from "./workspace-records-api";

type AccountRole = "contractor" | "tradesperson";
type PanelKind = "checklist" | "milestone" | "change_order" | "note";

interface LegacyChecklist {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

interface LegacyMilestone {
  id: string;
  label: string;
  amount: number;
  dueNote: string;
  status: "pending" | "paid" | "overdue";
  createdAt: string;
}

interface LegacyChangeOrder {
  id: string;
  jobId: number;
  description: string;
  requestedBy: string;
  costDelta: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface LegacyNote {
  id: string;
  text: string;
  createdAt: string;
}

type LegacyRecord = LegacyChecklist | LegacyMilestone | LegacyChangeOrder | LegacyNote;

interface WorkspaceRecordsPanelProps {
  projectId: string;
  jobId: number;
  kind: PanelKind;
  role: AccountRole;
  currentAccountId: string;
  jobPay?: number;
  jobTitle?: string;
}

interface RecordDraft {
  title: string;
  details: string;
  requestedBy: string;
  amount: string;
  dueNote: string;
  visibility: WorkspaceRecordVisibility;
}

const emptyDraft: RecordDraft = {
  title: "",
  details: "",
  requestedBy: "",
  amount: "",
  dueNote: "",
  visibility: "private",
};

const kindCopy: Record<PanelKind, { title: string; empty: string }> = {
  checklist: { title: "Punch list", empty: "No punch-list items yet." },
  milestone: { title: "Payment milestones", empty: "No payment milestones yet." },
  change_order: { title: "Change orders", empty: "No change orders requested yet." },
  note: { title: "Job notes", empty: "No notes yet." },
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function draftKey(projectId: string, kind: PanelKind) {
  return `rivt.workspaceDraft.${projectId}.${kind}.v1`;
}

function readDraft(projectId: string, kind: PanelKind) {
  return safeParse<RecordDraft>(localStorage.getItem(draftKey(projectId, kind)), emptyDraft);
}

function readLegacy(jobId: number, kind: PanelKind): LegacyRecord[] {
  if (kind === "checklist") {
    return safeParse<LegacyChecklist[]>(localStorage.getItem(`rivt.checklist.${jobId}.v1`), []);
  }
  if (kind === "milestone") {
    return safeParse<LegacyMilestone[]>(localStorage.getItem(`rivt.milestones.${jobId}.v1`), []);
  }
  if (kind === "note") {
    return safeParse<LegacyNote[]>(localStorage.getItem(`rivt.notes.${jobId}.v1`), []);
  }
  return safeParse<LegacyChangeOrder[]>(localStorage.getItem("rivt.changeOrders.v1"), [])
    .filter((item) => item.jobId === jobId);
}

function removeMovedLegacy(jobId: number, kind: PanelKind, movedIds: Set<string>) {
  if (kind === "change_order") {
    const all = safeParse<LegacyChangeOrder[]>(localStorage.getItem("rivt.changeOrders.v1"), []);
    localStorage.setItem("rivt.changeOrders.v1", JSON.stringify(all.filter((item) => !movedIds.has(item.id))));
    return;
  }
  const key = kind === "checklist"
    ? `rivt.checklist.${jobId}.v1`
    : kind === "milestone"
      ? `rivt.milestones.${jobId}.v1`
      : `rivt.notes.${jobId}.v1`;
  const all = safeParse<Array<{ id: string }>>(localStorage.getItem(key), []);
  localStorage.setItem(key, JSON.stringify(all.filter((item) => !movedIds.has(item.id))));
}

function legacyInput(kind: PanelKind, item: LegacyRecord) {
  if (kind === "checklist") {
    const record = item as LegacyChecklist;
    return { recordType: kind, title: record.text, state: record.done ? "done" : "open" } as const;
  }
  if (kind === "milestone") {
    const record = item as LegacyMilestone;
    return {
      recordType: kind,
      title: record.label,
      amountCents: Math.round(record.amount * 100),
      dueNote: record.dueNote,
      state: record.status,
    } as const;
  }
  if (kind === "change_order") {
    const record = item as LegacyChangeOrder;
    return {
      recordType: kind,
      title: record.description,
      requestedBy: record.requestedBy,
      amountCents: Math.round(record.costDelta * 100),
      state: record.status,
    } as const;
  }
  const record = item as LegacyNote;
  return {
    recordType: kind,
    details: record.text,
    visibility: "private" as const,
    state: "active" as const,
  };
}

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function stateLabel(state: WorkspaceRecordState) {
  return state.replaceAll("_", " ");
}

function editDraftFor(record: WorkspaceRecord): RecordDraft {
  return {
    title: record.title,
    details: record.details,
    requestedBy: record.requestedBy,
    amount: (record.amountCents / 100).toFixed(2),
    dueNote: record.dueNote,
    visibility: record.visibility,
  };
}

export function WorkspaceRecordsPanel({
  projectId,
  jobId,
  kind,
  role,
  currentAccountId,
  jobPay = 0,
  jobTitle = "",
}: WorkspaceRecordsPanelProps) {
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [archivedRecords, setArchivedRecords] = useState<WorkspaceRecord[]>([]);
  const [events, setEvents] = useState<WorkspaceRecordEvent[]>([]);
  const [draft, setDraft] = useState<RecordDraft>(() => readDraft(projectId, kind));
  const [legacy, setLegacy] = useState<LegacyRecord[]>(() => readLegacy(jobId, kind));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [editing, setEditing] = useState<WorkspaceRecord | null>(null);
  const [editDraft, setEditDraft] = useState<RecordDraft>(emptyDraft);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const result = await listWorkspaceRecords(projectId);
      setRecords(result.records.filter((record) => record.recordType === kind));
      setArchivedRecords(result.archivedRecords.filter((record) => record.recordType === kind));
      setEvents(result.events.filter((event) => event.recordType === kind));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Project and panel are intentionally remounted with a stable key by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, kind]);

  useEffect(() => {
    localStorage.setItem(draftKey(projectId, kind), JSON.stringify(draft));
  }, [draft, kind, projectId]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  );
  const doneCount = records.filter((record) => record.state === "done").length;
  const totalScheduled = records.reduce((sum, record) => sum + record.amountCents, 0);
  const totalPaid = records.filter((record) => record.state === "paid").reduce((sum, record) => sum + record.amountCents, 0);
  const approvedDelta = records.filter((record) => record.state === "approved").reduce((sum, record) => sum + record.amountCents, 0);
  const canCreate = kind !== "milestone" || role === "contractor";

  function updateDraft(patch: Partial<RecordDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function clearDraft() {
    setDraft(emptyDraft);
    localStorage.removeItem(draftKey(projectId, kind));
  }

  async function addRecord() {
    const title = draft.title.trim();
    const details = draft.details.trim();
    if ((kind === "note" ? !details : !title) || !canCreate) return;
    setWorking("create");
    setError("");
    setNotice("");
    try {
      const created = await createWorkspaceRecord(projectId, {
        recordType: kind as WorkspaceRecordType,
        visibility: kind === "note" ? draft.visibility : "shared",
        title,
        details,
        requestedBy: draft.requestedBy.trim(),
        amountCents: Math.round((Number(draft.amount) || 0) * 100),
        dueNote: draft.dueNote.trim(),
        state: kind === "checklist" ? "open" : kind === "note" ? "active" : "pending",
      });
      setRecords((current) => [...current, created]);
      clearDraft();
      setNotice(kind === "note" && created.visibility === "private" ? "Private note saved to your account." : "Job record synced.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That record could not be saved. Your draft remains on this device.");
    } finally {
      setWorking("");
    }
  }

  async function changeState(record: WorkspaceRecord, state: WorkspaceRecordState) {
    setWorking(record.id);
    setError("");
    try {
      const updated = await updateWorkspaceRecord(projectId, record.id, {
        expectedVersion: record.version,
        state,
      });
      setRecords((current) => current.map((item) => item.id === record.id ? updated : item));
      setNotice(state === "paid" ? "Payment marked paid as a manual job record." : "Job record updated.");
      await refresh();
    } catch (cause) {
      if (cause instanceof WorkspaceRecordsApiError && cause.code === "WORKSPACE_RECORD_CONFLICT") {
        setError("This record changed on another device. RIVT reloaded the current version.");
        await refresh();
      } else {
        setError(cause instanceof Error ? cause.message : "That record could not be updated.");
      }
    } finally {
      setWorking("");
    }
  }

  async function archive(record: WorkspaceRecord) {
    setWorking(record.id);
    setError("");
    try {
      await archiveWorkspaceRecord(projectId, record.id, record.version);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setNotice("Record archived. Its audit history remains.");
      await refresh();
    } catch (cause) {
      if (cause instanceof WorkspaceRecordsApiError && cause.code === "WORKSPACE_RECORD_CONFLICT") {
        setError("This record changed on another device. RIVT reloaded the current version.");
        await refresh();
      } else {
        setError(cause instanceof Error ? cause.message : "That record could not be archived.");
      }
    } finally {
      setWorking("");
    }
  }

  async function restore(record: WorkspaceRecord) {
    setWorking(record.id);
    setError("");
    try {
      await restoreWorkspaceRecord(projectId, record.id, record.version);
      setNotice("Record restored to this job.");
      await refresh();
    } catch (cause) {
      if (cause instanceof WorkspaceRecordsApiError && cause.code === "WORKSPACE_RECORD_CONFLICT") {
        setError("This record changed on another device. RIVT reloaded the current version.");
        await refresh();
      } else {
        setError(cause instanceof Error ? cause.message : "That record could not be restored.");
      }
    } finally {
      setWorking("");
    }
  }

  function startEditing(record: WorkspaceRecord) {
    setEditing(record);
    setEditDraft(editDraftFor(record));
    setError("");
    setNotice("");
  }

  async function saveEdit() {
    if (!editing) return;
    const title = editDraft.title.trim();
    const details = editDraft.details.trim();
    if (kind === "note" ? !details : !title) return;
    setWorking(editing.id);
    setError("");
    try {
      await updateWorkspaceRecord(projectId, editing.id, {
        expectedVersion: editing.version,
        visibility: kind === "note" ? editDraft.visibility : "shared",
        title,
        details,
        requestedBy: editDraft.requestedBy.trim(),
        amountCents: Math.round((Number(editDraft.amount) || 0) * 100),
        dueNote: editDraft.dueNote.trim(),
      });
      setEditing(null);
      setNotice("Job record updated.");
      await refresh();
    } catch (cause) {
      if (cause instanceof WorkspaceRecordsApiError && cause.code === "WORKSPACE_RECORD_CONFLICT") {
        setError("This record changed on another device. RIVT reloaded the current version; review it before editing again.");
        setEditing(null);
        await refresh();
      } else {
        setError(cause instanceof Error ? cause.message : "That record could not be updated.");
      }
    } finally {
      setWorking("");
    }
  }

  async function moveLegacyRecords() {
    if (!legacy.length || (kind === "milestone" && role !== "contractor")) return;
    setWorking("legacy");
    setError("");
    setNotice("");
    const movedIds = new Set<string>();
    for (const item of legacy) {
      try {
        await createWorkspaceRecord(projectId, legacyInput(kind, item));
        movedIds.add(item.id);
      } catch {
        // Keep every failed device record in place so a later retry cannot lose it.
      }
    }
    if (movedIds.size) {
      removeMovedLegacy(jobId, kind, movedIds);
      setLegacy((current) => current.filter((item) => !movedIds.has(item.id)));
      setNotice(`${movedIds.size} older device record${movedIds.size === 1 ? "" : "s"} moved to this job.`);
      await refresh();
    }
    if (movedIds.size !== legacy.length) {
      setError(`${legacy.length - movedIds.size} device record${legacy.length - movedIds.size === 1 ? "" : "s"} stayed on this device and can be retried.`);
    }
    setWorking("");
  }

  const progress = records.length ? Math.round((doneCount / records.length) * 100) : 0;
  const canEditRecord = (record: WorkspaceRecord) => (
    kind === "checklist"
    || (kind === "milestone" && role === "contractor")
    || (kind === "note" && record.createdByAccountId === currentAccountId)
    || (kind === "change_order" && (role === "contractor" || (record.createdByAccountId === currentAccountId && record.state === "pending")))
  );

  return (
    <section className={`v2-workspace-records v2-${kind}-records`} aria-label={kindCopy[kind].title}>
      <div className="v2-workspace-record-heading">
        <div>
          <h3>
            {kind === "checklist" ? <ListTodo size={17} /> : kind === "milestone" ? <DollarSign size={17} /> : kind === "note" ? <StickyNote size={17} /> : <RefreshCw size={17} />}
            {kindCopy[kind].title}
          </h3>
          <p>
            {kind === "note"
              ? "Private notes stay visible only to you. Shared notes are visible to both job participants."
              : kind === "milestone"
                ? "Both sides can view milestones. Only the contractor can change them. Paid status is recorded manually."
                : "Both job participants can see this record and its change history."}
          </p>
        </div>
        <span className="v2-workspace-sync-state">Account synced</span>
      </div>

      {legacy.length ? (
        <aside className="v2-workspace-legacy" aria-label="Older device records">
          <div>
            <strong>{legacy.length} older device record{legacy.length === 1 ? "" : "s"}</strong>
            <span>Move them explicitly. A device copy is removed only after its job record saves.</span>
          </div>
          {kind === "milestone" && role !== "contractor" ? (
            <small>The contractor must move payment milestones.</small>
          ) : (
            <button type="button" className="v2-secondary-button" disabled={working === "legacy"} onClick={() => void moveLegacyRecords()}>
              {working === "legacy" ? "Moving…" : "Move to job"}
            </button>
          )}
        </aside>
      ) : null}

      {kind === "checklist" && records.length ? (
        <div className="v2-checklist-progress">
          <div className="v2-checklist-bar"><div className="v2-checklist-bar-fill" style={{ width: `${progress}%` }} /></div>
          <span>{doneCount}/{records.length} done</span>
        </div>
      ) : null}

      {kind === "milestone" && records.length ? (
        <div className="v2-milestone-summary">
          {jobPay > 0 ? <div><span>Job budget</span><strong>{currency(Math.round(jobPay * 100))}</strong></div> : null}
          <div><span>Scheduled</span><strong>{currency(totalScheduled)}</strong></div>
          <div><span>Recorded paid</span><strong className="is-paid">{currency(totalPaid)}</strong></div>
        </div>
      ) : null}

      {kind === "change_order" && approvedDelta !== 0 ? (
        <div className="v2-co-approved-delta">
          <span>Approved scope delta</span>
          <strong className={approvedDelta < 0 ? "is-negative" : ""}>{approvedDelta > 0 ? "+" : ""}{currency(approvedDelta)}</strong>
        </div>
      ) : null}

      {canCreate ? (
        <div className={kind === "note" ? "v2-job-note-form" : kind === "milestone" ? "v2-milestone-form" : kind === "change_order" ? "v2-change-order-form" : "v2-checklist-add"}>
          {kind === "change_order" ? <h3>Request a change for {jobTitle}</h3> : kind === "milestone" ? <h3>Add milestone</h3> : null}
          {kind === "note" ? (
            <>
              <textarea value={draft.details} onChange={(event) => updateDraft({ details: event.target.value })} rows={3} placeholder="Add a decision or field observation…" />
              <label className="v2-note-visibility">
                <span>Who can see this note?</span>
                <select value={draft.visibility} onChange={(event) => updateDraft({ visibility: event.target.value as WorkspaceRecordVisibility })}>
                  <option value="private">Private to me</option>
                  <option value="shared">Both job participants</option>
                </select>
              </label>
            </>
          ) : kind === "checklist" ? (
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              onKeyDown={(event) => { if (event.key === "Enter") void addRecord(); }}
              placeholder="Add a punch-list item…"
            />
          ) : (
            <div className={kind === "milestone" ? "v2-milestone-inputs" : "v2-change-order-inputs"}>
              <label className={kind === "change_order" ? "is-wide" : ""}>
                {kind === "change_order" ? "What changed" : "Label"}
                {kind === "change_order"
                  ? <textarea value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} rows={2} placeholder="Describe the scope change…" />
                  : <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Deposit, midpoint, final…" />}
              </label>
              {kind === "change_order" ? (
                <label>Requested by<input value={draft.requestedBy} onChange={(event) => updateDraft({ requestedBy: event.target.value })} placeholder="Owner, GC, inspector…" /></label>
              ) : (
                <label>Due when<input value={draft.dueNote} onChange={(event) => updateDraft({ dueNote: event.target.value })} placeholder="On signing, 50% complete…" /></label>
              )}
              <label>{kind === "change_order" ? "Cost change ($)" : "Amount ($)"}<input type="number" inputMode="decimal" step="0.01" value={draft.amount} onChange={(event) => updateDraft({ amount: event.target.value })} placeholder="0.00" /></label>
            </div>
          )}
          <button type="button" className="v2-primary-button" disabled={working === "create" || (kind === "note" ? !draft.details.trim() : !draft.title.trim())} onClick={() => void addRecord()}>
            <Plus size={14} />{working === "create" ? "Saving…" : kind === "note" ? "Save note" : kind === "checklist" ? "Add item" : kind === "milestone" ? "Add milestone" : "Request change"}
          </button>
          {(draft.title || draft.details || draft.requestedBy || draft.amount || draft.dueNote) ? <small className="v2-workspace-draft-state">Unsubmitted draft is kept on this device until it syncs.</small> : null}
        </div>
      ) : (
        <p className="v2-workspace-permission-note">Only the contractor can add or change payment milestones. You can view the current record here.</p>
      )}

      {editing ? (
        <section className="v2-workspace-edit" aria-label={`Edit ${kindCopy[kind].title.toLowerCase()} record`}>
          <div className="v2-workspace-edit-heading">
            <strong>Edit record</strong>
            <button type="button" aria-label="Cancel editing" onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
          {kind === "note" ? (
            <>
              <textarea rows={3} value={editDraft.details} onChange={(event) => setEditDraft((current) => ({ ...current, details: event.target.value }))} />
              <label className="v2-note-visibility">
                <span>Who can see this note?</span>
                <select value={editDraft.visibility} onChange={(event) => setEditDraft((current) => ({ ...current, visibility: event.target.value as WorkspaceRecordVisibility }))}>
                  <option value="private">Private to me</option>
                  <option value="shared">Both job participants</option>
                </select>
              </label>
            </>
          ) : kind === "checklist" ? (
            <label>Item<input value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          ) : (
            <div className={kind === "milestone" ? "v2-milestone-inputs" : "v2-change-order-inputs"}>
              <label className={kind === "change_order" ? "is-wide" : ""}>
                {kind === "change_order" ? "What changed" : "Label"}
                {kind === "change_order"
                  ? <textarea rows={2} value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                  : <input value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />}
              </label>
              {kind === "change_order" ? (
                <label>Requested by<input value={editDraft.requestedBy} onChange={(event) => setEditDraft((current) => ({ ...current, requestedBy: event.target.value }))} /></label>
              ) : (
                <label>Due when<input value={editDraft.dueNote} onChange={(event) => setEditDraft((current) => ({ ...current, dueNote: event.target.value }))} /></label>
              )}
              <label>{kind === "change_order" ? "Cost change ($)" : "Amount ($)"}<input type="number" inputMode="decimal" step="0.01" value={editDraft.amount} onChange={(event) => setEditDraft((current) => ({ ...current, amount: event.target.value }))} /></label>
            </div>
          )}
          <button type="button" className="v2-primary-button" disabled={working === editing.id || (kind === "note" ? !editDraft.details.trim() : !editDraft.title.trim())} onClick={() => void saveEdit()}>
            {working === editing.id ? "Saving…" : "Save changes"}
          </button>
        </section>
      ) : null}

      {error ? <p className="v2-match-error" role="alert">{error}</p> : null}
      {notice ? <p className="v2-match-notice" role="status">{notice}</p> : null}

      {loading ? <p className="v2-muted-copy">Loading job records…</p> : sortedRecords.length ? (
        <div className={kind === "checklist" ? "v2-checklist-list" : kind === "milestone" ? "v2-milestone-list" : kind === "change_order" ? "v2-change-order-list" : "v2-job-note-list"}>
          {sortedRecords.map((record) => (
            kind === "checklist" ? (
              <div key={record.id} className={`v2-checklist-item${record.state === "done" ? " is-done" : ""}`}>
                <button type="button" className="v2-checklist-check" disabled={working === record.id} aria-pressed={record.state === "done"} aria-label={`${record.state === "done" ? "Mark incomplete" : "Mark complete"}: ${record.title}`} onClick={() => void changeState(record, record.state === "done" ? "open" : "done")}><Check size={13} /></button>
                <span>{record.title}</span>
                <button type="button" className="v2-checklist-delete" disabled={working === record.id} aria-label="Edit item" onClick={() => startEditing(record)}><Pencil size={13} /></button>
                <button type="button" className="v2-checklist-delete" disabled={working === record.id} aria-label="Archive item" onClick={() => void archive(record)}><Trash2 size={13} /></button>
              </div>
            ) : kind === "milestone" ? (
              <article key={record.id} className={`v2-milestone-card ms-status-${record.state}`}>
                <div className="v2-milestone-card-head">
                  <span className={`v2-ms-pill ms-status-${record.state}`}>{stateLabel(record.state)}</span>
                  <strong>{record.title}</strong><strong>{currency(record.amountCents)}</strong>
                  {role === "contractor" ? <button type="button" disabled={working === record.id} aria-label="Edit milestone" onClick={() => startEditing(record)}><Pencil size={13} /></button> : null}
                  {role === "contractor" ? <button type="button" disabled={working === record.id} aria-label="Archive milestone" onClick={() => void archive(record)}><Trash2 size={13} /></button> : null}
                </div>
                {record.dueNote ? <small>{record.dueNote}</small> : null}
                {record.state === "pending" && role === "contractor" ? (
                  <div className="v2-milestone-actions">
                    <button type="button" className="v2-primary-button" disabled={working === record.id} onClick={() => void changeState(record, "paid")}><Check size={13} />Record paid</button>
                    <button type="button" disabled={working === record.id} onClick={() => void changeState(record, "overdue")}>Mark overdue</button>
                  </div>
                ) : null}
              </article>
            ) : kind === "change_order" ? (
              <article key={record.id} className={`v2-co-card co-status-${record.state}`}>
                <div className="v2-co-card-header">
                  <span className={`v2-co-pill co-status-${record.state}`}>{stateLabel(record.state)}</span>
                  <small>{new Date(record.createdAt).toLocaleDateString()}</small>
                  {canEditRecord(record) ? <button type="button" disabled={working === record.id} aria-label="Edit change order" onClick={() => startEditing(record)}><Pencil size={13} /></button> : null}
                  {canEditRecord(record) ? <button type="button" disabled={working === record.id} aria-label="Archive change order" onClick={() => void archive(record)}><Trash2 size={13} /></button> : null}
                </div>
                <p>{record.title}</p>
                <div className="v2-co-meta"><span>Requested by: {record.requestedBy || "Not specified"}</span>{record.amountCents ? <strong className={record.amountCents < 0 ? "is-negative" : ""}>{record.amountCents > 0 ? "+" : ""}{currency(record.amountCents)}</strong> : null}</div>
                {record.state === "pending" && role === "contractor" ? (
                  <div className="v2-co-actions">
                    <button type="button" className="v2-primary-button" disabled={working === record.id} onClick={() => void changeState(record, "approved")}>Approve</button>
                    <button type="button" disabled={working === record.id} onClick={() => void changeState(record, "rejected")}>Reject</button>
                  </div>
                ) : null}
              </article>
            ) : (
              <article key={record.id} className="v2-job-note-card">
                <div className="v2-job-note-card-head">
                  <small>{record.visibility === "private" ? "Private to you" : "Shared with both sides"} · {new Date(record.createdAt).toLocaleString()}</small>
                  {canEditRecord(record) ? <button type="button" disabled={working === record.id} aria-label="Edit note" onClick={() => startEditing(record)}><Pencil size={13} /></button> : null}
                  {canEditRecord(record) ? <button type="button" disabled={working === record.id} aria-label="Archive note" onClick={() => void archive(record)}><Trash2 size={13} /></button> : null}
                </div>
                <p>{record.details}</p>
              </article>
            )
          ))}
        </div>
      ) : <p className="v2-muted-copy">{kindCopy[kind].empty}</p>}

      {archivedRecords.length ? (
        <details className="v2-workspace-archive">
          <summary>Archived records ({archivedRecords.length})</summary>
          <ul>
            {archivedRecords.map((record) => (
              <li key={record.id}>
                <span>{record.recordType === "note" ? record.details : record.title}</span>
                <button type="button" className="v2-secondary-button" disabled={working === record.id || !canEditRecord(record)} onClick={() => void restore(record)}>
                  <RotateCcw size={13} />Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {events.length ? (
        <details className="v2-workspace-history">
          <summary>Record history ({events.length})</summary>
          <ol>
            {events.slice(0, 12).map((event) => (
              <li key={event.id}>
                <span>{event.metadata.action === "restored" ? "restored" : event.eventType.replaceAll("_", " ")} by {event.actorDisplayName}</span>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
