import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import "./job-detail-hub.css";

interface StoredJob {
  id: string;
  title: string;
  location?: string;
  status?: string;
  startDate?: string;
  trade?: string;
  description?: string;
  createdAt?: string;
  quotedAt?: string;
  activeAt?: string;
  invoicedAt?: string;
  paidAt?: string;
}

interface TimeSession {
  id: string;
  jobId?: string;
  jobTitle?: string;
  startTime: string;
  endTime?: string;
  note?: string;
}

interface ExpenseEntry {
  id: string;
  jobId?: string;
  date: string;
  category: string;
  amount: number;
  description?: string;
}

interface PhotoEntry {
  id: string;
  jobId?: string;
  url: string;
  caption?: string;
  takenAt: string;
}

interface Client {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface MaterialItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  markup: number;
}

interface RateCard {
  hourlyRate: number;
}

interface JobDetailHubProps {
  jobId: string;
  onClose: () => void;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface SectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, count, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="v2-job-detail-section">
      <div
        className="v2-job-detail-section-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => !o); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="v2-job-detail-section-title">{title}</span>
          {count !== undefined ? (
            <span className="v2-job-detail-section-count">{count}</span>
          ) : null}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {open ? <div className="v2-job-detail-section-body">{children}</div> : null}
    </div>
  );
}

// ── Status Timeline ───────────────────────────────────────────────────────────

const PIPELINE_STAGES = ["Lead", "Quoted", "Active", "Invoiced", "Paid"] as const;
type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_TIMESTAMP_KEYS: Record<PipelineStage, keyof StoredJob> = {
  Lead: "createdAt",
  Quoted: "quotedAt",
  Active: "activeAt",
  Invoiced: "invoicedAt",
  Paid: "paidAt",
};

const STAGE_STATUS_VALUES: Record<PipelineStage, string[]> = {
  Lead: ["Lead"],
  Quoted: ["Quoted"],
  Active: ["Active"],
  Invoiced: ["Invoiced"],
  Paid: ["Paid", "Paid / Closed"],
};

function getStageIndex(status?: string): number {
  if (!status) return -1;
  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    if (STAGE_STATUS_VALUES[PIPELINE_STAGES[i]].includes(status)) return i;
  }
  return -1;
}

function StatusTimeline({ job, onJobUpdate }: { job: StoredJob; onJobUpdate: (updated: StoredJob) => void }) {
  const currentIdx = getStageIndex(job.status);

  function advanceTo(stage: PipelineStage, idx: number) {
    if (idx <= currentIdx) return;
    const tsKey = STAGE_TIMESTAMP_KEYS[stage];
    const updated: StoredJob = {
      ...job,
      status: stage === "Paid" ? "Paid / Closed" : stage,
      [tsKey]: new Date().toISOString(),
    };
    try {
      const stored = localStorage.getItem("rivt.jobs.v1");
      const jobs: StoredJob[] = stored ? (JSON.parse(stored) as StoredJob[]) : [];
      const next = Array.isArray(jobs) ? jobs.map((j) => j.id === job.id ? updated : j) : [updated];
      localStorage.setItem("rivt.jobs.v1", JSON.stringify(next));
    } catch { /* noop */ }
    onJobUpdate(updated);
  }

  function formatTs(ts?: string) {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch { return null; }
  }

  return (
    <div className="v2-status-timeline">
      <div className="v2-status-timeline-track">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          const tsKey = STAGE_TIMESTAMP_KEYS[stage];
          const ts = job[tsKey] as string | undefined;
          return (
            <div
              key={stage}
              className={["v2-status-step", isDone ? "is-done" : "", isCurrent ? "is-current" : "", isFuture ? "is-future" : ""].filter(Boolean).join(" ")}
            >
              <div
                className="v2-status-step-circle"
                role={isFuture ? "button" : undefined}
                tabIndex={isFuture ? 0 : undefined}
                title={isFuture ? `Advance to ${stage}` : undefined}
                onClick={() => { if (isFuture) advanceTo(stage, idx); }}
                onKeyDown={(e) => { if (isFuture && (e.key === "Enter" || e.key === " ")) advanceTo(stage, idx); }}
              >
                {idx + 1}
              </div>
              <span className="v2-status-step-label">{stage}</span>
              {formatTs(ts) ? <span className="v2-status-step-time">{formatTs(ts)}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JobDetailHub({ jobId, onClose }: JobDetailHubProps) {
  const [job, setJob] = useState<StoredJob | null>(null);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [rate, setRate] = useState<RateCard>({ hourlyRate: 75 });

  useEffect(() => {
    try {
      const jobs: StoredJob[] = JSON.parse(localStorage.getItem("rivt.jobs.v1") || "[]");
      const foundJob = jobs.find((j) => j.id === jobId) ?? null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJob(foundJob);

      const allSessions: TimeSession[] = JSON.parse(localStorage.getItem("rivt.timeSessions.v1") || "[]");
      setSessions(
        Array.isArray(allSessions)
          ? allSessions.filter((s) => s.jobId === jobId || s.jobTitle === foundJob?.title)
          : []
      );

      const allExpenses: ExpenseEntry[] = JSON.parse(localStorage.getItem("rivt.expenses.v1") || "[]");
      setExpenses(
        Array.isArray(allExpenses) ? allExpenses.filter((e) => e.jobId === jobId) : []
      );

      const allPhotos: PhotoEntry[] = JSON.parse(localStorage.getItem("rivt.photos.v1") || "[]");
      setPhotos(
        Array.isArray(allPhotos) ? allPhotos.filter((p) => p.jobId === jobId) : []
      );

      const allClients: Client[] = JSON.parse(localStorage.getItem("rivt.clients.v1") || "[]");
      if (Array.isArray(allClients) && allClients.length > 0) {
        const matched = foundJob?.title
          ? allClients.find((c) =>
              c.name.toLowerCase().includes(foundJob.title.toLowerCase()) ||
              foundJob.title.toLowerCase().includes(c.name.toLowerCase())
            )
          : null;
        setClient(matched ?? allClients[0] ?? null);
      }

      const materialsStore: Record<string, MaterialItem[]> = JSON.parse(
        localStorage.getItem("rivt.materials.v1") || "{}"
      );
      setMaterials(
        Array.isArray(materialsStore[jobId]) ? materialsStore[jobId] : []
      );

      const storedRate: RateCard = JSON.parse(
        localStorage.getItem("rivt.rateCard.v1") || '{"hourlyRate":75}'
      );
      setRate({ hourlyRate: storedRate?.hourlyRate ?? 75 });
    } catch {
      // silently handle parse errors
    }
  }, [jobId]);

  const totalHours = sessions.reduce((sum, s) => {
    if (!s.endTime) return sum;
    return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
  }, 0);
  const laborEarned = totalHours * rate.hourlyRate;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const materialsTotal = materials.reduce(
    (sum, m) => sum + m.qty * m.unitCost * (1 + m.markup / 100),
    0
  );
  const netProfit = laborEarned - totalExpenses;

  return (
    <div className="rivt-v2 v2-job-detail-overlay">
      {/* Header */}
      <div className="v2-job-detail-header">
        <button type="button" className="v2-job-detail-back" onClick={onClose}>
          <ArrowLeft size={16} /> Back
        </button>
        <span className="v2-job-detail-title">{job?.title ?? "Job Detail"}</span>
        {job?.status ? (
          <span className="v2-job-detail-badge">{job.status}</span>
        ) : null}
      </div>

      {/* Meta row */}
      {job ? (
        <div className="v2-job-detail-meta">
          {job.location ? <span>📍 {job.location}</span> : null}
          {job.trade ? <><span>·</span><span>{job.trade}</span></> : null}
          {job.startDate ? <><span>·</span><span>{job.startDate}</span></> : null}
        </div>
      ) : null}

      {/* Status Timeline */}
      {job ? (
        <StatusTimeline job={job} onJobUpdate={(updated) => setJob(updated)} />
      ) : null}

      {/* Stats row */}
      <div className="v2-job-detail-stat-row">
        <div className="v2-job-detail-stat">
          <div className="v2-job-detail-stat-value is-positive">{money(laborEarned)}</div>
          <div className="v2-job-detail-stat-label">Earned</div>
        </div>
        <div className="v2-job-detail-stat">
          <div className="v2-job-detail-stat-value">{money(totalExpenses)}</div>
          <div className="v2-job-detail-stat-label">Expenses</div>
        </div>
        <div className="v2-job-detail-stat">
          <div className={`v2-job-detail-stat-value${netProfit >= 0 ? " is-positive" : " is-negative"}`}>
            {money(netProfit)}
          </div>
          <div className="v2-job-detail-stat-label">Net</div>
        </div>
      </div>

      {/* Time Logged */}
      <Section title="Time Logged" count={sessions.length}>
        {sessions.length === 0 ? (
          <p className="v2-job-detail-empty">No time sessions logged for this job.</p>
        ) : (
          sessions.map((s) => {
            const hours =
              s.endTime
                ? (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000
                : null;
            const dateStr = new Date(s.startTime).toLocaleDateString();
            return (
              <div key={s.id} className="v2-job-detail-row">
                <div className="v2-job-detail-row-left">
                  <div>{dateStr}</div>
                  {s.note ? <div style={{ color: "var(--v2-text-muted)", fontSize: 12, marginTop: 2 }}>{s.note}</div> : null}
                </div>
                <div className="v2-job-detail-row-right">
                  {hours !== null ? formatDuration(hours) : "In progress"}
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* Expenses */}
      <Section title="Expenses" count={expenses.length}>
        {expenses.length === 0 ? (
          <p className="v2-job-detail-empty">No expenses logged for this job.</p>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="v2-job-detail-row">
              <div className="v2-job-detail-row-left">
                <div>{e.category}</div>
                {e.description ? <div style={{ color: "var(--v2-text-muted)", fontSize: 12, marginTop: 2 }}>{e.description}</div> : null}
              </div>
              <div className="v2-job-detail-row-right">{money(e.amount)}</div>
            </div>
          ))
        )}
      </Section>

      {/* Photos */}
      <Section title="Photos" count={photos.length}>
        {photos.length === 0 ? (
          <p className="v2-job-detail-empty">No photos saved for this job.</p>
        ) : (
          <div className="v2-job-detail-photos-grid">
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt={p.caption ?? "Job photo"}
                className="v2-job-detail-photo-thumb"
              />
            ))}
          </div>
        )}
      </Section>

      {/* Client */}
      <Section title="Client">
        {client === null ? (
          <p className="v2-job-detail-empty">No client linked to this job.</p>
        ) : (
          <div>
            <div className="v2-job-detail-client-row">
              <strong>{client.name}</strong>
              {client.company ? <span style={{ color: "var(--v2-text-muted)" }}>{client.company}</span> : null}
            </div>
            {client.phone ? (
              <div className="v2-job-detail-client-row">
                <a href={`tel:${client.phone}`}>{client.phone}</a>
              </div>
            ) : null}
            {client.email ? (
              <div className="v2-job-detail-client-row">
                <a href={`mailto:${client.email}`}>{client.email}</a>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      {/* Materials */}
      <Section title="Materials">
        {materials.length === 0 ? (
          <p className="v2-job-detail-empty">No materials saved for this job.</p>
        ) : (
          <>
            {materials.map((m) => {
              const lineTotal = m.qty * m.unitCost * (1 + m.markup / 100);
              return (
                <div key={m.id} className="v2-job-detail-row">
                  <div className="v2-job-detail-row-left">
                    <div>{m.name}</div>
                    <div style={{ color: "var(--v2-text-muted)", fontSize: 12, marginTop: 2 }}>
                      {m.qty} {m.unit} × {money(m.unitCost)}{m.markup > 0 ? ` +${m.markup}%` : ""}
                    </div>
                  </div>
                  <div className="v2-job-detail-row-right">{money(lineTotal)}</div>
                </div>
              );
            })}
            <div className="v2-job-detail-row" style={{ borderTop: "1px solid var(--v2-border)", marginTop: 4 }}>
              <div className="v2-job-detail-row-left" style={{ fontWeight: "var(--v2-weight-bold)" as React.CSSProperties["fontWeight"] }}>Total</div>
              <div className="v2-job-detail-row-right" style={{ color: "var(--v2-text)" }}>{money(materialsTotal)}</div>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
